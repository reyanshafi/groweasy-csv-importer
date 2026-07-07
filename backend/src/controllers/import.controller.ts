import type { Request, Response } from "express";
import { config } from "../config.js";
import { isCrmFormatHeaders, type ImportEvent } from "../domain/crm.js";
import { ApiError } from "../middleware/error.js";
import { recordAiImport } from "../middleware/rateLimit.js";
import { parseCsvBuffer } from "../services/csv.service.js";
import { runImport } from "../services/import.service.js";

/**
 * POST /api/import — multipart upload ("file") of a CSV.
 *
 * Responds with NDJSON (one JSON event per line) so the client can render
 * live batch progress: a "start" event, a "batch" event per completed AI
 * batch, and a terminal "result" (or "error") event.
 */
export async function importCsv(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded. Send the CSV as multipart field "file".');
  }

  const { headers, rows } = parseCsvBuffer(req.file.buffer);
  const isPassthrough = isCrmFormatHeaders(headers);
  // CRM-format files are validated without AI, so they work even without a key.
  if (!config.geminiApiKey && !isPassthrough) {
    throw new ApiError(500, "Server is missing GEMINI_API_KEY — AI extraction is unavailable.");
  }
  if (rows.length > config.maxRows) {
    throw new ApiError(
      413,
      `CSV has ${rows.length} data rows; the maximum per import is ${config.maxRows}.`,
    );
  }

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  // Only AI imports count against the per-IP budget — passthrough costs nothing.
  if (!isPassthrough) recordAiImport(req);

  res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering so progress arrives live
  res.flushHeaders();

  const emit = (event: ImportEvent) => {
    if (!res.writableEnded) res.write(JSON.stringify(event) + "\n");
  };

  try {
    const result = await runImport(rows, headers, emit);
    emit({ type: "result", ...result });
  } catch (error) {
    // Headers are already sent — report the failure in-band.
    console.error("[import] fatal:", error);
    emit({
      type: "error",
      message: error instanceof Error ? error.message : "Import failed unexpectedly",
    });
  }
  res.end();
}
