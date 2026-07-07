export interface RetryOptions {
  /** Total attempts, including the first one. */
  attempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retry with exponential backoff and jitter. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts, baseDelayMs = 750, maxDelayMs = 8000, onRetry }: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      onRetry?.(attempt, error);
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(backoff + Math.random() * 250);
    }
  }
  throw lastError;
}
