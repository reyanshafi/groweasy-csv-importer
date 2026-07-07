import type { ImportEvent, ImportProgress, ImportResult } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Upload a CSV to the backend and consume its NDJSON progress stream.
 * `onEvent` fires for every streamed event; resolves with the final result.
 */
export async function importCsv(
  file: File,
  onEvent: (event: ImportEvent) => void,
  signal?: AbortSignal,
): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/import`, { method: "POST", body: form, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("Could not reach the API server. Is the backend running?");
  }

  if (!response.ok) {
    let message = `Import failed (HTTP ${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    throw new Error(message);
  }

  if (!response.body) throw new Error("This browser does not support streaming responses.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ImportResult | null = null;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as ImportEvent;
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "result") {
      result = {
        summary: event.summary,
        records: event.records,
        skipped: event.skipped,
        mappings: event.mappings ?? [],
      };
    }
    onEvent(event);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      handleLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
    }
  }
  handleLine(buffer); // trailing line without newline, if any

  if (!result) throw new Error("The import stream ended unexpectedly without a result.");
  return result;
}

export function applyEventToProgress(
  progress: ImportProgress | null,
  event: ImportEvent,
): ImportProgress | null {
  switch (event.type) {
    case "start":
      return {
        totalRows: event.totalRows,
        totalBatches: event.totalBatches,
        batchesCompleted: 0,
        rowsProcessed: 0,
        imported: 0,
        skipped: 0,
      };
    case "batch":
      return {
        totalRows: progress?.totalRows ?? event.rowsProcessed,
        totalBatches: event.totalBatches,
        batchesCompleted: event.batchesCompleted,
        rowsProcessed: event.rowsProcessed,
        imported: event.imported,
        skipped: event.skipped,
      };
    default:
      return progress;
  }
}
