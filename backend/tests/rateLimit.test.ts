import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SlidingWindowLimiter } from "../src/middleware/rateLimit.js";

const WINDOW = 10 * 60_000; // 10 minutes
const T0 = 1_000_000;

describe("SlidingWindowLimiter", () => {
  it("allows up to the limit, then blocks with a retry hint", () => {
    const limiter = new SlidingWindowLimiter(3, WINDOW);
    for (let i = 0; i < 3; i++) {
      assert.equal(limiter.retryAfterSec("ip1", T0 + i), 0);
      limiter.record("ip1", T0 + i);
    }
    const wait = limiter.retryAfterSec("ip1", T0 + 1000);
    assert.ok(wait > 0 && wait <= WINDOW / 1000, `unexpected wait ${wait}`);
  });

  it("frees slots as old hits leave the window", () => {
    const limiter = new SlidingWindowLimiter(2, WINDOW);
    limiter.record("ip1", T0);
    limiter.record("ip1", T0 + 1000);
    assert.ok(limiter.retryAfterSec("ip1", T0 + 2000) > 0);
    // first hit expires after T0 + WINDOW
    assert.equal(limiter.retryAfterSec("ip1", T0 + WINDOW + 1), 0);
  });

  it("tracks callers independently", () => {
    const limiter = new SlidingWindowLimiter(1, WINDOW);
    limiter.record("ip1", T0);
    assert.ok(limiter.retryAfterSec("ip1", T0 + 1) > 0);
    assert.equal(limiter.retryAfterSec("ip2", T0 + 1), 0);
  });

  it("computes retry-after as time until the oldest hit expires", () => {
    const limiter = new SlidingWindowLimiter(1, WINDOW);
    limiter.record("ip1", T0);
    const now = T0 + 4 * 60_000; // 4 minutes in
    assert.equal(limiter.retryAfterSec("ip1", now), 6 * 60); // 6 minutes left
  });

  it("is a no-op when disabled (max 0)", () => {
    const limiter = new SlidingWindowLimiter(0, WINDOW);
    assert.equal(limiter.enabled, false);
    limiter.record("ip1", T0);
    limiter.record("ip1", T0 + 1);
    assert.equal(limiter.retryAfterSec("ip1", T0 + 2), 0);
  });
});
