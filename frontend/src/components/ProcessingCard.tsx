"use client";

import type { ImportProgress } from "@/lib/types";

interface ProcessingCardProps {
  progress: ImportProgress | null;
  onCancel: () => void;
}

export function ProcessingCard({ progress, onCancel }: ProcessingCardProps) {
  const percent =
    progress && progress.totalBatches > 0
      ? Math.round((progress.batchesCompleted / progress.totalBatches) * 100)
      : 0;

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-bold tracking-tight">AI is mapping your leads…</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {progress
          ? `Batch ${Math.min(progress.batchesCompleted + 1, progress.totalBatches)} of ${progress.totalBatches} · ${progress.rowsProcessed.toLocaleString()} / ${progress.totalRows.toLocaleString()} rows processed`
          : "Uploading file and preparing batches…"}
      </p>

      <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {progress ? (
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(percent, 3)}%` }}
          />
        ) : (
          <div className="h-full w-2/5 rounded-full bg-emerald-500/70 animate-shimmer" />
        )}
      </div>
      <p className="mt-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">
        {progress ? `${percent}%` : "starting…"}
      </p>

      {progress && (
        <dl className="mt-6 grid grid-cols-2 gap-3 text-left text-sm">
          <Stat label="Imported so far" value={progress.imported} tone="good" />
          <Stat label="Skipped so far" value={progress.skipped} tone="warn" />
        </dl>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="mt-8 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Cancel import
      </button>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd
        className={
          tone === "good"
            ? "text-lg font-bold text-emerald-600 dark:text-emerald-400"
            : "text-lg font-bold text-amber-600 dark:text-amber-400"
        }
      >
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
