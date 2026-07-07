# GrowEasy - AI CSV Importer

Import CRM leads from **any** CSV — Facebook lead exports, Google Ads, other CRMs, hand-made spreadsheets — regardless of column names, order, or formatting. Gemini maps whatever columns exist into the GrowEasy CRM schema, with server-side validation guaranteeing the output always follows the CRM rules.

**Flow:** Upload (drag & drop) → Preview (virtualized table, no AI yet) → Confirm → live batch-by-batch AI progress → Results (imported + skipped records, downloadable CRM CSV).

## Tech stack

| Layer | Choices |
| --- | --- |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4, TanStack Virtual, PapaParse, react-dropzone |
| Backend | Node.js, Express 5, TypeScript (ESM), Multer, csv-parse |
| AI | Gemini (`@google/genai`) with structured output (JSON schema), temperature 0 |

## Quick start

Prereqs: Node 20+, a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # then put your GEMINI_API_KEY in .env
npm run dev                 # http://localhost:4000

# 2. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local  # defaults to http://localhost:4000
npm run dev                 # http://localhost:3000
```

### Run the tests

```bash
cd backend
npm test
```

31 unit tests (Node's built-in `node:test`, zero extra dependencies) cover the CRM rule enforcement — enum coercion, `new Date()` parseability, contact validation, skip logic, line-break escaping — plus header-agnostic CSV parsing (duplicate/blank headers, BOM, quoted line breaks) and the retry/concurrency utilities.

Try it with the intentionally messy files in [`samples/`](samples/) — a Facebook leads export, a Google Ads lead-form export, a real-estate CRM dump, an international sales report and a hand-made sheet. Between them they cover ALL-CAPS names, multiple emails/phones in one cell, DD/MM vs MM/DD dates, trunk-zero numbers, +1/+44/+971 country codes, quoted line breaks, fuzzy statuses ("Ringing no response", "Deal Closed!!") and rows with no contact info (skipped, with reasons). `manual-clean-leads.csv` is the happy path: 8/8 rows import with zero skips.

## How it works

```
┌──────────┐   multipart CSV    ┌─────────────────────────────────────────┐
│ Next.js  │ ─────────────────► │ Express: parse CSV → chunk into batches │
│ frontend │ ◄───────────────── │ → Gemini per batch (3 in parallel,      │
└──────────┘   NDJSON stream    │   3 retries w/ backoff) → validate →    │
   progress + final result      │   aggregate imported/skipped            │
                                └─────────────────────────────────────────┘
```

1. **Preview is local.** The browser parses the CSV with PapaParse purely for display. Nothing touches the AI until the user confirms.
2. **`POST /api/import`** accepts the raw file, re-parses it server-side (header-agnostic: blank/duplicate headers are normalized instead of dropped), and splits rows into batches of 100.
3. **AI extraction** sends each batch to Gemini with a JSON **response schema**, so the model physically cannot return malformed output, and `temperature: 0` for determinism. Batches run 3-at-a-time with exponential-backoff retry; a batch that fails all retries never kills the import — its rows are reported as skipped with the reason.
4. **Validation is not delegated to the AI.** Every mapped record is re-checked in code: status/source enum membership, `new Date()`-parseability of `created_at`, email/phone syntax, line-break escaping, and the skip rule (no email **and** no mobile ⇒ skipped). A hallucinated value degrades to `""`, never into corrupt data.
5. **Progress streams back as NDJSON** — one event per completed batch — which drives the live progress bar. The final line carries the full result.

### API

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Liveness + model + whether an API key is configured |
| `POST /api/import` | Multipart field `file` (.csv ≤ 10 MB, ≤ 2000 rows). Responds `application/x-ndjson`: `start` → `batch`× N → `result` (or `error`) |

<details>
<summary>Example NDJSON stream</summary>

```json
{"type":"start","totalRows":48,"totalBatches":3,"batchSize":20}
{"type":"batch","batchIndex":0,"totalBatches":3,"batchesCompleted":1,"rowsProcessed":20,"imported":18,"skipped":2,"failed":false}
{"type":"batch","batchIndex":1,"totalBatches":3,"batchesCompleted":2,"rowsProcessed":40,"imported":37,"skipped":3,"failed":false}
{"type":"result","summary":{"totalRows":48,"imported":44,"skipped":4,"totalBatches":3,"failedBatches":0,"durationMs":9120,"model":"gemini-2.5-flash"},"records":[...],"skipped":[...]}
```
</details>

### Prompt design

The system prompt (see [`backend/src/services/ai.service.ts`](backend/src/services/ai.service.ts)) treats the model as a *data-migration engine*, not a chatbot:

- **Semantic status mapping** — "call back tomorrow" → `GOOD_LEAD_FOLLOW_UP`, "ringing" → `DID_NOT_CONNECT`, "Deal Closed!!" → `SALE_DONE`, with explicit synonym tables for each of the 4 allowed statuses.
- **Fuzzy-but-safe source matching** — "Meridian Towers Campaign" → `meridian_tower`, "LOD" → `leads_on_demand`; anything uncertain stays blank rather than forced.
- **Nothing is invented** — missing values are `""`; placeholder junk (`N/A`, `-`, `null`) is stripped.
- **First-contact rule** — first email/phone becomes primary, the rest are appended to `crm_note`, matching the spec.
- **Date discipline** — output is ISO 8601 so `new Date()` always parses; ambiguous `04/05/2026`-style dates default to day-first (Indian convention, documented tradeoff).
- Every row must come back (same `row_index`, same order), so dropped rows are detectable and reported.

### Engineering notes

- **Batching + bounded concurrency** keep latency low without hammering rate limits; failed batches degrade gracefully into skipped rows.
- **Virtualized tables** (TanStack Virtual) render 5 visible rows or 2000 with identical performance; sticky headers, both scroll axes, responsive down to mobile.
- **Dark mode** — class-based, pre-paint init script (no flash), persisted, system-preference default.
- **Config via env** — batch size, concurrency, retries, row/file limits, CORS origin and model are all tunable without code changes (see [`backend/.env.example`](backend/.env.example)).
- **Import cancel** — the frontend aborts the fetch; the user lands back on Preview.

## Env vars

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | backend | — (required) | Gemini auth |
| `GEMINI_MODEL` | backend | `gemini-2.5-flash` | Model id |
| `PORT` | backend | `4000` | API port |
| `CORS_ORIGIN` | backend | `*` | Comma-separated allowed origins |
| `BATCH_SIZE` / `BATCH_CONCURRENCY` / `AI_MAX_RETRIES` | backend | `100` / `3` / `3` | AI pipeline tuning |
| `MAX_ROWS` / `MAX_FILE_SIZE_MB` | backend | `2000` / `10` | Upload limits |
| `IMPORT_RATE_LIMIT` / `IMPORT_RATE_WINDOW_MIN` | backend | `5` / `10` | Per-IP cap on AI imports (passthrough exempt); `0` disables |
| `NEXT_PUBLIC_API_URL` | frontend | `http://localhost:4000` | Backend base URL |

## Docker

```bash
# from the repo root — create a .env file here containing GEMINI_API_KEY=your_key
docker compose up --build
```

Frontend on http://localhost:3000, backend on http://localhost:4000. Both images are multi-stage builds; the frontend uses Next.js standalone output so the runtime image ships without `node_modules`.

## Deployment

- **Frontend → Vercel:** import the repo, set *Root Directory* to `frontend`, add `NEXT_PUBLIC_API_URL` pointing at the deployed backend.
- **Backend → Render/Railway:** root `backend`, build `npm install && npm run build`, start `npm start`, add `GEMINI_API_KEY` (and set `CORS_ORIGIN` to the Vercel URL).

## Project structure

```
backend/src/
  index.ts, app.ts          server bootstrap + middleware wiring
  config.ts                 typed env config
  routes/                   /api routes + multer upload rules
  controllers/              NDJSON streaming import controller
  services/                 csv parsing · Gemini extraction · import orchestration
  domain/                   CRM schema/types · rule validation
  utils/                    chunking, concurrency pool, retry/backoff
frontend/src/
  app/                      layout (theme, shell) + wizard page
  components/               UploadStep · PreviewStep · ProcessingCard · ResultsStep ·
                            DataTable (virtualized) · Stepper · ThemeToggle
  lib/                      api client (NDJSON reader) · csv helpers · shared types
samples/                    messy CSVs to demo with
```
