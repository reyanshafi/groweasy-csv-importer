import "dotenv/config";

function intEnv(name: string, fallback: number, min = 1): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= min ? value : fallback;
}

export const config = {
  port: intEnv("PORT", 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",

  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",

  /** Rows sent to the model per request. */
  batchSize: intEnv("BATCH_SIZE", 100),
  /** AI batches processed in parallel. */
  batchConcurrency: intEnv("BATCH_CONCURRENCY", 3),
  /** Attempts per batch before its rows are reported as skipped. */
  aiMaxRetries: intEnv("AI_MAX_RETRIES", 3),

  maxRows: intEnv("MAX_ROWS", 2000),
  maxFileSizeMb: intEnv("MAX_FILE_SIZE_MB", 10),

  /** Max AI imports per IP per window; 0 disables the limiter. */
  importRateLimit: intEnv("IMPORT_RATE_LIMIT", 5, 0),
  importRateWindowMinutes: intEnv("IMPORT_RATE_WINDOW_MIN", 10),
} as const;

export type AppConfig = typeof config;
