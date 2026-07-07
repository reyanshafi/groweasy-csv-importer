import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsvBuffer } from "../src/services/csv.service.js";
import { ApiError } from "../src/middleware/error.js";

const csv = (text: string) => Buffer.from(text, "utf8");

describe("parseCsvBuffer", () => {
  it("parses a simple CSV into keyed rows", () => {
    const { headers, rows } = parseCsvBuffer(csv("name,email\nJohn,john@x.com\nJane,jane@x.com"));
    assert.deepEqual(headers, ["name", "email"]);
    assert.deepEqual(rows, [
      { name: "John", email: "john@x.com" },
      { name: "Jane", email: "jane@x.com" },
    ]);
  });

  it("normalizes blank and duplicate headers instead of dropping columns", () => {
    const { headers } = parseCsvBuffer(csv("name,,phone,name\na,b,c,d"));
    assert.deepEqual(headers, ["name", "column_2", "phone", "name_2"]);
  });

  it("keeps overflow cells from rows wider than the header", () => {
    const { rows } = parseCsvBuffer(csv("a,b\n1,2,3"));
    assert.equal(rows[0]["column_3"], "3");
  });

  it("drops fully empty rows", () => {
    const { rows } = parseCsvBuffer(csv("a,b\n1,2\n,\n3,4"));
    assert.equal(rows.length, 2);
  });

  it("handles quoted fields containing commas and line breaks", () => {
    const { rows } = parseCsvBuffer(csv('name,note\nJo,"busy, call\nlater"'));
    assert.equal(rows[0].note, "busy, call\nlater");
  });

  it("strips a UTF-8 BOM", () => {
    const { headers } = parseCsvBuffer(csv("\uFEFFname,email\nx,y"));
    assert.deepEqual(headers, ["name", "email"]);
  });

  it("rejects an empty file with a 400", () => {
    assert.throws(
      () => parseCsvBuffer(csv("")),
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
  });

  it("rejects a header-only file with a 400", () => {
    assert.throws(
      () => parseCsvBuffer(csv("name,email")),
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
  });
});
