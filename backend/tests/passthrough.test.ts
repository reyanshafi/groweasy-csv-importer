import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CRM_FIELDS, isCrmFormatHeaders, type ImportEvent } from "../src/domain/crm.js";
import { runImport } from "../src/services/import.service.js";

describe("isCrmFormatHeaders", () => {
  it("accepts the full CRM schema in any casing", () => {
    assert.equal(isCrmFormatHeaders([...CRM_FIELDS]), true);
    assert.equal(isCrmFormatHeaders(CRM_FIELDS.map((f) => f.toUpperCase())), true);
  });

  it("accepts a subset of CRM fields", () => {
    assert.equal(isCrmFormatHeaders(["name", "email", "crm_status"]), true);
  });

  it("rejects when any extra column is present", () => {
    assert.equal(isCrmFormatHeaders([...CRM_FIELDS, "campaign_name"]), false);
  });

  it("rejects arbitrary export headers", () => {
    assert.equal(isCrmFormatHeaders(["Full Name", "Ph#", "Mail ID"]), false);
  });

  it("rejects degenerate single-column files", () => {
    assert.equal(isCrmFormatHeaders(["name"]), false);
  });
});

describe("runImport — passthrough mode", () => {
  it("validates CRM-format rows without any AI service (no API key needed)", async () => {
    const headers = ["name", "email", "mobile_without_country_code", "crm_status"];
    const rows = [
      { name: "John Doe", email: "john@x.com", mobile_without_country_code: "9876543210", crm_status: "GOOD_LEAD_FOLLOW_UP" },
      { name: "Bad Status", email: "bad@x.com", mobile_without_country_code: "", crm_status: "SOMETHING_ELSE" },
      { name: "No Contact", email: "", mobile_without_country_code: "", crm_status: "" },
    ];

    const events: ImportEvent[] = [];
    const result = await runImport(rows, headers, (event) => events.push(event));

    assert.equal(result.summary.mode, "passthrough");
    assert.equal(result.summary.imported, 2);
    assert.equal(result.summary.skipped, 1);
    assert.equal(result.summary.failedBatches, 0);

    // rules are still enforced without AI
    assert.equal(result.records[0].crm_status, "GOOD_LEAD_FOLLOW_UP");
    assert.equal(result.records[1].crm_status, "");
    assert.equal(result.skipped[0].row_index, 2);

    assert.deepEqual(
      events.map((event) => event.type),
      ["start", "plan", "batch"],
    );

    // identity mapping plan: every header maps to itself
    assert.deepEqual(result.mappings[0], { source_column: "name", crm_field: "name" });
    assert.equal(result.mappings.length, headers.length);
  });
});
