/**
 * Server-side enforcement of the CRM extraction rules.
 *
 * The model is instructed to follow every rule, but LLM output is never
 * trusted blindly: enums, date parseability, contact-info presence and
 * CSV-safety (no raw line breaks) are all re-checked here.
 */
import {
  CRM_FIELDS,
  CRM_STATUSES,
  DATA_SOURCES,
  type CrmRecord,
  type MappedRecord,
} from "./crm.js";

/** Shape returned by the model for one row (all fields optional/nullable). */
export interface AiRecord extends Partial<Record<string, unknown>> {
  row_index: number;
  skip?: boolean;
  skip_reason?: string;
}

export type FinalizeResult =
  | { ok: true; record: MappedRecord }
  | { ok: false; reason: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Collapse raw line breaks so every record stays a single CSV row. */
function toSingleLine(value: string, escapeAs: string): string {
  return value.replace(/\r\n|\r|\n/g, escapeAs).trim();
}

function asCleanString(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  const lowered = text.trim();
  // Models occasionally emit literal placeholders instead of empty strings.
  if (/^(null|undefined|n\/a|na|none|-)$/i.test(lowered)) return "";
  return lowered;
}

function appendNote(note: string, addition: string): string {
  if (!addition) return note;
  return note ? `${note} | ${addition}` : addition;
}

/** Validate + normalize one AI-mapped row into a final CRM record, or reject it. */
export function finalizeRecord(ai: AiRecord): FinalizeResult {
  if (ai.skip) {
    return { ok: false, reason: asCleanString(ai.skip_reason) || "No email or mobile number found" };
  }

  const record = Object.fromEntries(CRM_FIELDS.map((f) => [f, asCleanString(ai[f])])) as CrmRecord;

  // Notes may legitimately contain line breaks — escape them as literal "\n"
  // per the spec; every other field is flattened with a space.
  for (const field of CRM_FIELDS) {
    const escapeAs = field === "crm_note" || field === "description" ? "\\n" : " ";
    record[field] = toSingleLine(record[field], escapeAs);
  }

  // created_at must survive `new Date(created_at)`.
  if (record.created_at && Number.isNaN(new Date(record.created_at).getTime())) {
    record.crm_note = appendNote(record.crm_note, `Unparsed date: ${record.created_at}`);
    record.created_at = "";
  }

  // Strict enums — anything else becomes blank.
  const status = record.crm_status.toUpperCase().replace(/[\s-]+/g, "_");
  record.crm_status = (CRM_STATUSES as readonly string[]).includes(status) ? status : "";

  const source = record.data_source.toLowerCase().replace(/[\s-]+/g, "_");
  record.data_source = (DATA_SOURCES as readonly string[]).includes(source) ? source : "";

  // Email: keep only a syntactically valid address; preserve rejects in the note.
  if (record.email) {
    const email = record.email.toLowerCase();
    if (EMAIL_RE.test(email)) {
      record.email = email;
    } else {
      record.crm_note = appendNote(record.crm_note, `Unparsed email: ${record.email}`);
      record.email = "";
    }
  }

  // Mobile: digits only; too-short values are demoted to the note.
  if (record.mobile_without_country_code) {
    const digits = record.mobile_without_country_code.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) {
      record.mobile_without_country_code = digits;
    } else {
      record.crm_note = appendNote(
        record.crm_note,
        `Unparsed mobile: ${record.mobile_without_country_code}`,
      );
      record.mobile_without_country_code = "";
    }
  }

  if (record.country_code) {
    const cc = record.country_code.replace(/[^\d]/g, "");
    record.country_code = cc && cc.length <= 4 ? `+${cc}` : "";
  }
  // A country code without a number is meaningless.
  if (!record.mobile_without_country_code) record.country_code = "";

  // The one hard business rule: a lead must be reachable.
  if (!record.email && !record.mobile_without_country_code) {
    return { ok: false, reason: "No valid email or mobile number" };
  }

  return { ok: true, record: { ...record, row_index: ai.row_index } };
}
