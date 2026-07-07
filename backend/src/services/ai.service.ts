import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { config } from "../config.js";
import { CRM_FIELDS, CRM_STATUSES, DATA_SOURCES, type IndexedRow } from "../domain/crm.js";
import type { AiRecord } from "../domain/validation.js";

/**
 * Maps batches of arbitrary CSV rows into GrowEasy CRM records using Gemini
 * with structured output (JSON schema, temperature 0) so responses are
 * machine-parseable by construction.
 */

const SYSTEM_INSTRUCTION = `You are a meticulous CRM data-migration engine for GrowEasy, an Indian real-estate/sales CRM.
You receive a JSON array of raw rows from an arbitrary CSV export (Facebook Leads, Google Ads, other CRMs, hand-made spreadsheets — column names are unpredictable, may be abbreviated, misspelled, in any order, or in other languages).
For EVERY input row you must return exactly one output object mapping the row into the GrowEasy CRM schema.

TARGET FIELDS
- created_at: when the lead was created/captured (look for: date, created, timestamp, enquiry date, lead date, submitted at...).
- name: the lead's full name. Combine first/middle/last name columns with single spaces. Use proper capitalization if the source is ALL CAPS or lowercase.
- email: the lead's primary email address.
- country_code: phone country code with "+" (e.g. "+91").
- mobile_without_country_code: the lead's mobile/phone number WITHOUT the country code, digits only.
- company: company/organization/business name.
- city, state, country: location fields. If only a combined address/location column exists, decompose it. Infer state from a well-known city (e.g. Mumbai -> Maharashtra, Bengaluru -> Karnataka) and country from state/city or phone country code when unambiguous.
- lead_owner: the salesperson/agent/owner the lead is assigned to (often an email).
- crm_status: the lead's pipeline status (see STATUS RULES).
- crm_note: free-text notes (see NOTE RULES).
- data_source: the campaign/project source (see SOURCE RULES).
- possession_time: property possession timeframe if present (e.g. "Ready to move", "Dec 2027").
- description: any remaining descriptive info about the lead's requirement (e.g. "3BHK, budget 1.2Cr") that fits no other field.

STATUS RULES — crm_status MUST be one of ${JSON.stringify([...CRM_STATUSES])} or "".
Map source statuses by MEANING:
- interested / warm / hot / follow up / callback / demo scheduled / in progress / qualified -> GOOD_LEAD_FOLLOW_UP
- no answer / not reachable / unreachable / ringing / busy / switched off / call later / no response -> DID_NOT_CONNECT
- not interested / junk / spam / invalid / wrong number / lost / dead / cold / disqualified -> BAD_LEAD
- converted / won / closed / purchased / booked / sale done / deal closed -> SALE_DONE
If the source has no status or it cannot be mapped confidently, use "".

SOURCE RULES — data_source MUST be one of ${JSON.stringify([...DATA_SOURCES])} or "".
Match flexibly on meaning/spelling ("Meridian Towers Campaign" -> "meridian_tower", "Sarjapur plot enquiry" -> "sarjapur_plots", "LOD" -> "leads_on_demand"). If nothing matches confidently, use "" — NEVER force a value. The original text can go to crm_note if informative.

DATE RULES
- Output created_at in ISO 8601 "YYYY-MM-DDTHH:mm:ss" (or "YYYY-MM-DD" when no time is present) so JavaScript new Date() parses it.
- Interpret source formats carefully (epoch timestamps, "13-May-2026", "05/13/26 2:20 PM"...). If day/month is ambiguous (e.g. 04/05/2026), assume day-first (DD/MM), the common Indian convention.
- If no creation date exists or it cannot be parsed, use "".

PHONE RULES
- Normalize numbers: strip spaces, dashes, brackets. Put the country code (e.g. "+91") in country_code and the remaining digits in mobile_without_country_code.
- A 10-digit Indian mobile (starts 6-9) with Indian context (city/state/+91 elsewhere in the row) -> country_code "+91". A leading "0" trunk prefix on such numbers should be dropped. Do not guess country codes without evidence.
- If a cell contains multiple numbers, the FIRST is the primary; append the others to crm_note (e.g. "Alt phone: ...").

EMAIL RULES
- Lowercase. If multiple emails exist, the FIRST is primary; append the others to crm_note (e.g. "Alt email: ...").

NOTE RULES
- crm_note collects: remarks/comments/feedback columns, extra phones/emails, unmapped-but-useful info (e.g. original unmappable status or source text, budget, agent remarks).
- Join multiple pieces with " | ". Never use real line breaks — replace any with "\\n".

SKIP RULES
- If a row has NEITHER an email NOR a usable phone number, return it with skip=true and a short skip_reason. Still set row_index correctly.
- Never skip a row that has at least one contact method, even if everything else is missing.

GENERAL RULES
- NEVER invent data. If a value is absent, output "". Do not copy placeholder junk ("N/A", "null", "-", "test").
- Do not put the same source value in two fields unless it genuinely belongs in both.
- Preserve the input order and return one object per input row with its exact row_index. The "records" array length MUST equal the number of input rows.`;

const RECORD_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    records: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          row_index: { type: Type.INTEGER },
          skip: { type: Type.BOOLEAN },
          skip_reason: { type: Type.STRING },
          ...Object.fromEntries(
            CRM_FIELDS.map((field) => [field, { type: Type.STRING, nullable: true }]),
          ),
        },
        required: ["row_index"],
        propertyOrdering: ["row_index", "skip", "skip_reason", ...CRM_FIELDS],
      },
    },
  },
  required: ["records"],
};

/** Cap individual cell size so one pathological cell can't blow the context. */
const MAX_CELL_CHARS = 400;

function compactRow(row: IndexedRow): IndexedRow {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(row.data)) {
    if (value === "") continue; // empty cells carry no signal, only tokens
    data[key] = value.length > MAX_CELL_CHARS ? `${value.slice(0, MAX_CELL_CHARS)}…` : value;
  }
  return { row_index: row.row_index, data };
}

export class AiExtractionService {
  private readonly client: GoogleGenAI;

  constructor(apiKey: string = config.geminiApiKey) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Add it to backend/.env (see .env.example).");
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  /** Map one batch of rows. Throws on API/parse failure — caller handles retry. */
  async mapBatch(rows: IndexedRow[]): Promise<AiRecord[]> {
    const payload = rows.map(compactRow);

    const response = await this.client.models.generateContent({
      model: config.geminiModel,
      contents: `Map these ${payload.length} CSV rows to GrowEasy CRM records:\n${JSON.stringify(payload)}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RECORD_SCHEMA,
        temperature: 0,
        // Deterministic mapping needs no reasoning budget; keeps latency/cost low.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");

    let parsed: { records?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gemini returned invalid JSON");
    }
    if (!Array.isArray(parsed.records)) {
      throw new Error("Gemini response is missing the records array");
    }

    return parsed.records.filter(
      (r): r is AiRecord => typeof r === "object" && r !== null && "row_index" in r,
    );
  }
}
