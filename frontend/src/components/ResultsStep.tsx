"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { DataTable } from "./DataTable";
import { downloadRecordsCsv, downloadSkippedCsv } from "@/lib/csv";
import { CRM_FIELDS, type ColumnMapping, type ImportResult } from "@/lib/types";

interface ResultsStepProps {
  result: ImportResult;
  /** Header names of the source file, used to display skipped rows. */
  sourceHeaders: string[];
  sourceFileName: string;
  onRestart: () => void;
}

type Tab = "imported" | "skipped";

export function ResultsStep({ result, sourceHeaders, sourceFileName, onRestart }: ResultsStepProps) {
  const { summary, records, skipped, mappings } = result;
  const [tab, setTab] = useState<Tab>(records.length > 0 ? "imported" : "skipped");

  const importedRows = useMemo(
    () => records.map((record) => CRM_FIELDS.map((field) => record[field])),
    [records],
  );
  const skippedHeaders = useMemo(() => ["skip reason", ...sourceHeaders], [sourceHeaders]);
  const skippedRows = useMemo(
    () => skipped.map((entry) => [entry.reason, ...sourceHeaders.map((h) => entry.raw[h] ?? "")]),
    [skipped, sourceHeaders],
  );

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Import complete</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {summary.mode === "passthrough" ? (
              <>
                File was already in GrowEasy CRM format — validated{" "}
                {summary.totalRows.toLocaleString()} rows instantly, no AI needed.
              </>
            ) : (
              <>
                Processed {summary.totalRows.toLocaleString()} rows in{" "}
                {(summary.durationMs / 1000).toFixed(1)}s across {summary.totalBatches} AI{" "}
                {summary.totalBatches === 1 ? "batch" : "batches"} ({summary.model}).
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRestart}
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Import another file
          </button>
          {skipped.length > 0 && (
            <button
              type="button"
              onClick={() => downloadSkippedCsv(skipped, sourceHeaders, sourceFileName)}
              className="flex items-center gap-2 rounded-lg border border-amber-300 px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40"
            >
              <DownloadIcon />
              Download skipped rows
            </button>
          )}
          {records.length > 0 && (
            <button
              type="button"
              onClick={() => downloadRecordsCsv(records, sourceFileName)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <DownloadIcon />
              Download CRM CSV
            </button>
          )}
        </div>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total rows" value={summary.totalRows} />
        <SummaryCard label="Imported" value={summary.imported} tone="good" />
        <SummaryCard label="Skipped" value={summary.skipped} tone={summary.skipped > 0 ? "warn" : undefined} />
        <SummaryCard
          label="Success rate"
          value={
            summary.totalRows > 0
              ? `${Math.round((summary.imported / summary.totalRows) * 100)}%`
              : "—"
          }
        />
      </dl>

      {summary.failedBatches > 0 && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          {summary.failedBatches} {summary.failedBatches === 1 ? "batch" : "batches"} failed even
          after retries — those rows are listed under “Skipped”. You can re-import just those rows
          later.
        </div>
      )}

      {mappings.length > 0 && <MappingPanel mappings={mappings} />}

      <div className="mb-4 flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900 sm:w-fit">
        <TabButton active={tab === "imported"} onClick={() => setTab("imported")}>
          Imported ({records.length.toLocaleString()})
        </TabButton>
        <TabButton active={tab === "skipped"} onClick={() => setTab("skipped")}>
          Skipped ({skipped.length.toLocaleString()})
        </TabButton>
      </div>

      {tab === "imported" ? (
        records.length > 0 ? (
          <DataTable
            headers={[...CRM_FIELDS]}
            rows={importedRows}
            rowLabels={(i) => records[i].row_index + 1}
            heightClass="max-h-[50vh]"
          />
        ) : (
          <EmptyState message="No records could be imported from this file." />
        )
      ) : skipped.length > 0 ? (
        <DataTable
          headers={skippedHeaders}
          rows={skippedRows}
          rowLabels={(i) => skipped[i].row_index + 1}
          heightClass="max-h-[50vh]"
        />
      ) : (
        <EmptyState message="Nothing was skipped, every row was imported." />
      )}
    </section>
  );
}

function MappingPanel({ mappings }: { mappings: ColumnMapping[] }) {
  const mapped = mappings.filter((m) => m.crm_field !== "ignored");
  const ignored = mappings.filter((m) => m.crm_field === "ignored");

  return (
    <details className="mb-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-800 [&::-webkit-details-marker]:hidden dark:text-zinc-100">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-emerald-600 dark:text-emerald-400">
          <path d="M4 7h11m0 0-3-3m3 3-3 3m8 7H9m0 0 3-3m-3 3 3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        How your columns were mapped
        <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
          {mapped.length} mapped{ignored.length > 0 && ` · ${ignored.length} ignored`} — click to
          expand
        </span>
      </summary>
      <div className="grid gap-x-6 gap-y-2 border-t border-zinc-100 px-4 py-4 sm:grid-cols-2 dark:border-zinc-800">
        {[...mapped, ...ignored].map((mapping, index) => (
          <div key={index} className="flex min-w-0 items-baseline gap-2 text-sm">
            <code className="max-w-[45%] truncate rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {mapping.source_column}
            </code>
            <span className="text-zinc-300 dark:text-zinc-600">→</span>
            {mapping.crm_field === "ignored" ? (
              <span className="text-xs italic text-zinc-400 dark:text-zinc-500">ignored</span>
            ) : (
              <code className="truncate rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                {mapping.crm_field}
              </code>
            )}
            {mapping.note && (
              <span className="hidden truncate text-xs text-zinc-400 sm:inline dark:text-zinc-500" title={mapping.note}>
                {mapping.note}
              </span>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd
        className={clsx(
          "mt-0.5 text-2xl font-bold tracking-tight",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </dd>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex-1 rounded-md px-4 py-1.5 transition-colors sm:flex-none",
        active
          ? "bg-emerald-600 text-white shadow-sm"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      {message}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path
        d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
