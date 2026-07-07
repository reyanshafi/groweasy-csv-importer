import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

/**
 * Per-IP cap on AI imports so one visitor can't drain the Gemini quota and
 * kill the demo for everyone else. Passthrough imports are never counted —
 * they cost no AI requests.
 *
 * In-memory sliding window: right-sized for a single-instance deployment;
 * swap for a shared store only if the backend ever scales horizontally.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  get enabled(): boolean {
    return this.max > 0;
  }

  /** Seconds until a slot frees up, or 0 when the caller is under the limit. */
  retryAfterSec(key: string, now: number = Date.now()): number {
    if (!this.enabled) return 0;
    const recent = this.prune(key, now);
    if (recent.length < this.max) return 0;
    return Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000));
  }

  record(key: string, now: number = Date.now()): void {
    if (!this.enabled) return;
    const recent = this.prune(key, now);
    recent.push(now);
    this.hits.set(key, recent);
    // Opportunistic sweep so long-idle IPs don't accumulate forever.
    if (this.hits.size > 1000) {
      for (const staleKey of this.hits.keys()) this.prune(staleKey, now);
    }
  }

  private prune(key: string, now: number): number[] {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length === 0) this.hits.delete(key);
    else this.hits.set(key, recent);
    return recent;
  }
}

const importLimiter = new SlidingWindowLimiter(
  config.importRateLimit,
  config.importRateWindowMinutes * 60_000,
);

const clientKey = (req: Request): string => req.ip ?? "unknown";

/** Reject the request early when the caller has exhausted their import budget. */
export function importRateLimit(req: Request, res: Response, next: NextFunction): void {
  const wait = importLimiter.retryAfterSec(clientKey(req));
  if (wait > 0) {
    res.setHeader("Retry-After", String(wait));
    res.status(429).json({
      error: `Too many imports from this IP — try again in ~${Math.max(1, Math.ceil(wait / 60))} min.`,
    });
    return;
  }
  next();
}

/** Count one AI import against the caller (called only on the AI path). */
export function recordAiImport(req: Request): void {
  importLimiter.record(clientKey(req));
}
