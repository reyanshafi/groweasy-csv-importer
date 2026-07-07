import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chunk, mapWithConcurrency } from "../src/utils/batch.js";
import { withRetry } from "../src/utils/retry.js";
import { rateLimitDelayMs } from "../src/services/ai.service.js";

describe("chunk", () => {
  it("splits into evenly sized batches with a remainder", () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });

  it("returns a single batch when size exceeds length", () => {
    assert.deepEqual(chunk([1, 2], 10), [[1, 2]]);
  });

  it("handles an empty input", () => {
    assert.deepEqual(chunk([], 3), []);
  });

  it("rejects a non-positive size", () => {
    assert.throws(() => chunk([1], 0));
  });
});

describe("mapWithConcurrency", () => {
  it("processes every item exactly once", async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      seen.push(item);
    });
    assert.deepEqual(seen.toSorted((a, b) => a - b), [1, 2, 3, 4, 5]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
    });
    assert.ok(peak <= 3, `peak concurrency was ${peak}`);
  });
});

describe("withRetry", () => {
  it("returns immediately on first success", async () => {
    let calls = 0;
    const value = await withRetry(async () => ++calls, { attempts: 3, baseDelayMs: 1 });
    assert.equal(value, 1);
    assert.equal(calls, 1);
  });

  it("retries until success and reports each retry", async () => {
    let calls = 0;
    const retries: number[] = [];
    const value = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("flaky");
        return "ok";
      },
      { attempts: 3, baseDelayMs: 1, onRetry: (attempt) => retries.push(attempt) },
    );
    assert.equal(value, "ok");
    assert.deepEqual(retries, [1, 2]);
  });

  it("throws the last error once attempts are exhausted", async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(
        async () => {
          calls++;
          throw new Error(`fail ${calls}`);
        },
        { attempts: 3, baseDelayMs: 1 },
      ),
      /fail 3/,
    );
    assert.equal(calls, 3);
  });

  it("uses the server-suggested delay instead of backoff when provided", async () => {
    let calls = 0;
    const start = Date.now();
    await withRetry(
      async () => {
        calls++;
        if (calls === 1) throw new Error("quota exceeded. Please retry in 0.05s.");
        return "ok";
      },
      {
        attempts: 2,
        baseDelayMs: 5000, // would be slow if the suggested delay were ignored
        delayForError: () => 50,
      },
    );
    assert.equal(calls, 2);
    assert.ok(Date.now() - start < 3000, "should not have used the 5s base backoff");
  });
});

describe("rateLimitDelayMs", () => {
  it("parses the suggested wait from a Gemini 429 message", () => {
    const error = new Error(
      'You exceeded your current quota... "code": 429 ... Please retry in 11.774002931s.',
    );
    assert.equal(rateLimitDelayMs(error), 11.774002931 * 1000 + 1000);
  });

  it("parses minute+second waits", () => {
    assert.equal(
      rateLimitDelayMs(new Error("rate limit — please try again in 1m2.8s")),
      60_000, // 62.8s + 1s buffer, capped at 60s
    );
  });

  it("falls back to 15s(+buffer) for quota errors without a hint", () => {
    assert.equal(rateLimitDelayMs(new Error("RESOURCE_EXHAUSTED")), 16_000);
  });

  it("caps the wait at 60s", () => {
    assert.equal(rateLimitDelayMs(new Error("quota — Please retry in 300s.")), 60_000);
  });

  it("returns undefined for non-rate-limit errors", () => {
    assert.equal(rateLimitDelayMs(new Error("Gemini returned invalid JSON")), undefined);
    assert.equal(rateLimitDelayMs(new Error("network reset")), undefined);
  });
});
