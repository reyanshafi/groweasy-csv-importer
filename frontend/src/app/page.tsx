import Link from "next/link";

/** Landing page — short hero that funnels into the /import wizard. */
export default function LandingPage() {
  return (
    <div className="relative">
      {/* decorative background: grid + emerald glow */}
      <div aria-hidden className="hero-grid absolute inset-x-0 -top-8 -z-10 h-[34rem]" />
      <div
        aria-hidden
        className="absolute left-1/2 top-0 -z-10 h-64 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/15"
      />

      <section className="mx-auto flex max-w-3xl flex-col items-center px-2 py-10 text-center sm:py-16">
      <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        AI-powered - Gemini
      </span>

      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Turn any messy CSV into{" "}
        <span className="text-emerald-600 dark:text-emerald-400">clean CRM leads</span>
      </h1>

      <p className="mt-5 max-w-xl text-base text-zinc-500 sm:text-lg dark:text-zinc-400">
        Facebook lead exports, ad reports, hand-made spreadsheets - whatever the column names,
        the AI maps them into GrowEasy CRM records. Statuses normalized, dates fixed, nothing
        invented.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/import"
          className="group inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          Import your CSV
          <ArrowUpRightIcon />
        </Link>
        <a
          href="https://github.com/reyanshafi/groweasy-csv-importer"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <GitHubIcon />
          View on GitHub
        </a>
      </div>

      {/* before → after mapping visual */}
      <div className="mt-12 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <div className="w-full max-w-xs rounded-xl border border-zinc-200 bg-white p-4 text-left font-mono text-xs leading-6 text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <p className="mb-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            your csv
          </p>
          <p className="truncate">Full_Name: &quot;RAHUL S.&quot;</p>
          <p className="truncate">Ph#: &quot;91-98220 11223&quot;</p>
          <p className="truncate">Status: &quot;ringing, try later&quot;</p>
        </div>
        <span className="rotate-90 text-2xl text-emerald-500 sm:rotate-0" aria-hidden>
          →
        </span>
        <div className="w-full max-w-xs rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-left font-mono text-xs leading-6 text-emerald-800 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <p className="mb-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-emerald-500">
            groweasy crm
          </p>
          <p className="truncate">name: Rahul S</p>
          <p className="truncate">mobile: +91 · 9822011223</p>
          <p className="truncate">status: DID_NOT_CONNECT</p>
        </div>
      </div>

      <ul className="mt-14 grid w-full gap-4 text-left sm:grid-cols-3">
        <FeatureCard
          title="Any format"
          description="No fixed column names — the AI reads your layout, whatever tool exported it."
          icon={<LayersIcon />}
        />
        <FeatureCard
          title="Live progress"
          description="Rows are processed in batches that stream back in real time, with retry on failures."
          icon={<PulseIcon />}
        />
        <FeatureCard
          title="Validated output"
          description="Every record is re-checked in code — statuses, dates and contacts always valid."
          icon={<ShieldCheckIcon />}
        />
      </ul>
      </section>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="group rounded-xl border border-zinc-200 bg-white/80 p-5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-emerald-800">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-900/50 dark:text-emerald-400 dark:group-hover:bg-emerald-600 dark:group-hover:text-white">
        {icon}
      </span>
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </li>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
    >
      <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.15c0 .3.21.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path
        d="M12 3 3 8l9 5 9-5-9-5Zm-9 9 9 5 9-5M3 16.5l9 5 9-5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M3 12h4l3-8 4 16 3-8h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path
        d="M12 3 5 6v5c0 4.5 3 8.1 7 9 4-.9 7-4.5 7-9V6l-7-3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
