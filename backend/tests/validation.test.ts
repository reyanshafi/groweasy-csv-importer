import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalizeRecord } from "../src/domain/validation.js";

const base = { row_index: 0, email: "lead@example.com" };

describe("finalizeRecord — skip rules", () => {
  it("rejects a record with neither email nor mobile", () => {
    const result = finalizeRecord({ row_index: 1, name: "No Contact" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /email or mobile/i);
  });

  it("honors the AI skip flag and its reason", () => {
    const result = finalizeRecord({ row_index: 2, skip: true, skip_reason: "Junk row" });
    assert.deepEqual(result, { ok: false, reason: "Junk row" });
  });

  it("keeps a record that has only a mobile number", () => {
    const result = finalizeRecord({ row_index: 3, mobile_without_country_code: "9876543210" });
    assert.equal(result.ok, true);
  });
});

describe("finalizeRecord — enum enforcement", () => {
  it("normalizes near-miss statuses into the allowed enum", () => {
    const result = finalizeRecord({ ...base, crm_status: "good lead follow-up" });
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.record.crm_status, "GOOD_LEAD_FOLLOW_UP");
  });

  it("blanks statuses outside the enum", () => {
    const result = finalizeRecord({ ...base, crm_status: "HOT_LEAD" });
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.record.crm_status, "");
  });

  it("normalizes and validates data_source, blanking non-matches", () => {
    const ok = finalizeRecord({ ...base, data_source: "Meridian Tower" });
    const bad = finalizeRecord({ ...base, data_source: "facebook_ads" });
    assert.ok(ok.ok && bad.ok);
    if (ok.ok) assert.equal(ok.record.data_source, "meridian_tower");
    if (bad.ok) assert.equal(bad.record.data_source, "");
  });
});

describe("finalizeRecord — created_at", () => {
  it("keeps dates that new Date() can parse", () => {
    const result = finalizeRecord({ ...base, created_at: "2026-05-13T14:20:48" });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.record.created_at, "2026-05-13T14:20:48");
      assert.ok(!Number.isNaN(new Date(result.record.created_at).getTime()));
    }
  });

  it("clears unparseable dates and preserves them in the note", () => {
    const result = finalizeRecord({ ...base, created_at: "13/05/2026 2pm-ish" });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.record.created_at, "");
      assert.match(result.record.crm_note, /Unparsed date/);
    }
  });
});

describe("finalizeRecord — contact hygiene", () => {
  it("lowercases valid emails and rejects invalid ones into the note", () => {
    const valid = finalizeRecord({ row_index: 0, email: "Lead@Example.COM" });
    assert.ok(valid.ok);
    if (valid.ok) assert.equal(valid.record.email, "lead@example.com");

    const invalid = finalizeRecord({
      row_index: 0,
      email: "sunita s@gmail",
      mobile_without_country_code: "9822098220",
    });
    assert.ok(invalid.ok);
    if (invalid.ok) {
      assert.equal(invalid.record.email, "");
      assert.match(invalid.record.crm_note, /Unparsed email: sunita s@gmail/);
    }
  });

  it("strips formatting from mobile numbers", () => {
    const result = finalizeRecord({ ...base, mobile_without_country_code: "98220-11223 " });
    assert.ok(result.ok);
    if (result.ok) assert.equal(result.record.mobile_without_country_code, "9822011223");
  });

  it("demotes too-short numbers to the note", () => {
    const result = finalizeRecord({ ...base, mobile_without_country_code: "12345" });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.record.mobile_without_country_code, "");
      assert.match(result.record.crm_note, /Unparsed mobile/);
    }
  });

  it("normalizes country codes and drops them without a mobile", () => {
    const withMobile = finalizeRecord({
      ...base,
      country_code: "91",
      mobile_without_country_code: "9876543210",
    });
    assert.ok(withMobile.ok);
    if (withMobile.ok) assert.equal(withMobile.record.country_code, "+91");

    const withoutMobile = finalizeRecord({ ...base, country_code: "+91" });
    assert.ok(withoutMobile.ok);
    if (withoutMobile.ok) assert.equal(withoutMobile.record.country_code, "");
  });
});

describe("finalizeRecord — CSV safety", () => {
  it("escapes line breaks in notes and flattens them elsewhere", () => {
    const result = finalizeRecord({
      ...base,
      name: "Line\nBroken",
      crm_note: "wants corner plot\r\neast facing",
    });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.record.name, "Line Broken");
      assert.equal(result.record.crm_note, "wants corner plot\\neast facing");
    }
  });

  it("strips placeholder junk values", () => {
    const result = finalizeRecord({ ...base, company: "N/A", city: "-", state: "null" });
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.record.company, "");
      assert.equal(result.record.city, "");
      assert.equal(result.record.state, "");
    }
  });
});
