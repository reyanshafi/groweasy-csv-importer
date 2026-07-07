import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeMappings } from "../src/domain/validation.js";

const headers = ["Full Name", "Ph#", "Mail ID", "GCLID"];

describe("normalizeMappings", () => {
  it("keeps valid entries and matches source columns case-insensitively", () => {
    const result = normalizeMappings(
      [
        { source_column: "full name", crm_field: "name" },
        { source_column: "Mail ID", crm_field: "EMAIL" },
      ],
      headers,
    );
    assert.deepEqual(
      result.filter((m) => m.crm_field !== "ignored"),
      [
        { source_column: "Full Name", crm_field: "name" },
        { source_column: "Mail ID", crm_field: "email" },
      ],
    );
  });

  it("allows one source column to feed two CRM fields", () => {
    const result = normalizeMappings(
      [
        { source_column: "Ph#", crm_field: "country_code" },
        { source_column: "Ph#", crm_field: "mobile_without_country_code" },
      ],
      headers,
    );
    const phone = result.filter((m) => m.source_column === "Ph#");
    assert.deepEqual(
      phone.map((m) => m.crm_field),
      ["country_code", "mobile_without_country_code"],
    );
  });

  it("drops unknown columns, invalid targets and duplicates", () => {
    const result = normalizeMappings(
      [
        { source_column: "Not A Column", crm_field: "name" },
        { source_column: "Full Name", crm_field: "made_up_field" },
        { source_column: "Full Name", crm_field: "name" },
        { source_column: "Full Name", crm_field: "name" },
        { not: "even the right shape" },
      ],
      headers,
    );
    assert.deepEqual(
      result.filter((m) => m.crm_field !== "ignored"),
      [{ source_column: "Full Name", crm_field: "name" }],
    );
  });

  it("pads unmentioned columns as ignored, sorted after mapped ones", () => {
    const result = normalizeMappings([{ source_column: "Mail ID", crm_field: "email" }], headers);
    assert.deepEqual(result, [
      { source_column: "Mail ID", crm_field: "email" },
      { source_column: "Full Name", crm_field: "ignored" },
      { source_column: "Ph#", crm_field: "ignored" },
      { source_column: "GCLID", crm_field: "ignored" },
    ]);
  });

  it("trims and caps notes", () => {
    const result = normalizeMappings(
      [{ source_column: "Ph#", crm_field: "mobile_without_country_code", note: `  ${"x".repeat(300)}  ` }],
      headers,
    );
    assert.equal(result[0].note?.length, 160);
  });
});
