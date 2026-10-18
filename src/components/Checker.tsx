"use client";

import { useMemo, useState } from "react";
import type { AnalyzeResult } from "@/lib/ai";
import { evaluate, type Check, type JurisdictionResult, type Report, type Status } from "@/lib/evaluate";
import { JURISDICTIONS } from "@/lib/jurisdictions";

const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "Missing pay (Denver)",
    text: `Senior Product Designer — Denver, CO (Hybrid)

We're a fast-growing fintech looking for a young, energetic rockstar to own our design system.
You'll partner with engineering and product to ship features used by millions.

What you bring:
- 5+ years of product design experience
- Strong Figma skills
- Excellent communication

Competitive salary, commensurate with experience.`,
  },
  {
    label: "Remote, US-wide",
    text: `Data Engineer — Remote (US)

Build and maintain the pipelines that power our analytics platform. You'll work with Python, dbt and Snowflake,
and partner closely with analysts and data scientists across the business.

Compensation: $125,000 - $155,000 per year, plus annual bonus.
Benefits: medical, dental and vision insurance, 401(k) with 4% match, 20 days PTO, 16 weeks parental leave.

Applications close November 30, 2026.`,
  },
  {
    label: "Hourly (New Jersey)",
    text: `Warehouse Associate — Newark, NJ

Pick, pack and ship customer orders in our Newark fulfillment center. Full-time, day shift.
Must be able to lift 50 lbs.

Pay: $21/hour. Health benefits, paid time off and weekly pay.`,
  },
];

const STATUS_STYLE: Record<Status, { label: string; fg: string; bg: string }> = {
  pass: { label: "Pass", fg: "var(--pass)", bg: "var(--pass-bg)" },
  warn: { label: "Review", fg: "var(--warn)", bg: "var(--warn-bg)" },
  fail: { label: "Fix", fg: "var(--fail)", bg: "var(--fail-bg)" },
  info: { label: "Note", fg: "var(--info)", bg: "var(--info-bg)" },
};

const POSTING_STATES = JURISDICTIONS.filter((j) => j.level === "state").sort((a, b) => a.name.localeCompare(b.name));

function Badge({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: s.fg, background: s.bg }}
    >
      {s.label}
    </span>
  );
}

function CheckRow({ c }: { c: Check }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <Badge status={c.status} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{c.label}</p>
        <p className="text-sm text-muted">{c.detail}</p>
      </div>
    </li>
  );
}

const APPLICABILITY_LABEL: Record<JurisdictionResult["applicability"], string> = {
  "in-force": "In force",
  upcoming: "Coming soon",
  "below-threshold": "Below size threshold",
  "on-request": "Disclose on request",
};

function JurisdictionCard({ r }: { r: JurisdictionResult }) {
  const j = r.jurisdiction;
  const [open, setOpen] = useState(r.status === "fail" || r.status === "warn");
  return (
    <div className="rounded-xl border border-line bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="font-medium">{j.name}</p>
          <p className="text-xs text-muted">
            {APPLICABILITY_LABEL[r.applicability]} · {r.reason}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={r.status} />
          <span className="text-muted" aria-hidden>{open ? "−" : "+"}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-line px-4 pb-4 pt-1">
          <ul className="divide-y divide-line">
            {r.checks.map((c) => <CheckRow key={c.id} c={c} />)}
          </ul>
          <p className="mt-3 text-xs text-muted">
            <span className="font-medium text-ink">Coverage:</span> {j.coverage}
            {j.notes ? ` ${j.notes}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">
            Effective {j.effective} · {j.minEmployees > 1 ? `${j.minEmployees}+ employees` : "Any employer"} · Sources:{" "}
            {j.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ", "}
                <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:text-accent">
                  {s.label}
                </a>
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}

function ReportView({ report, source }: { report: Report; source: "rules" | "ai" }) {
  const inForce = report.results.filter((r) => r.applicability === "in-force");
  const other = report.results.filter((r) => r.applicability !== "in-force");
  return (
    <>
      <div
        className="rounded-xl p-5"
        style={{ background: STATUS_STYLE[report.summary.status].bg, color: STATUS_STYLE[report.summary.status].fg }}
      >
        <p className="font-serif text-2xl">{headline(report)}</p>
        <p className="mt-1 text-sm opacity-90">
          {report.summary.covered} law{report.summary.covered === 1 ? "" : "s"} in force for this posting
          {report.summary.warnings ? ` · ${report.summary.warnings} item${report.summary.warnings === 1 ? "" : "s"} to review` : ""}
        </p>
      </div>

      <div className="rounded-xl border border-line bg-card px-4 py-3 text-sm">
        <p className="mb-1 flex flex-wrap items-center justify-between gap-2 font-medium">
          What we read
          <span className="text-xs font-normal text-muted">
            {source === "ai" ? "Read by Claude · judged by the rules engine" : "Read by the built-in parser"}
          </span>
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted">
          <dt>Pay</dt>
          <dd className="text-ink">{report.parsed.pay ? report.parsed.pay.raw : "None found"}</dd>
          <dt>Locations</dt>
          <dd className="text-ink">{[...report.parsed.states, ...report.parsed.locals].join(", ") || "None found"}</dd>
          <dt>Remote</dt>
          <dd className="text-ink">
            {{ "us-wide": "Remote, US-wide", remote: "Remote/hybrid, region unclear", none: "Not remote / limited to listed states" }[report.parsed.remote]}
          </dd>
          <dt>Benefits</dt>
          <dd className="text-ink">{report.parsed.mentionsBenefits ? "Mentioned" : "Not mentioned"}</dd>
          <dt>Deadline</dt>
          <dd className="text-ink">{report.parsed.closeDate ?? "Not found"}</dd>
        </dl>
      </div>

      {report.general.length > 0 && (
        <div>
          <h2 className="mb-2 font-serif text-xl">General checks</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card px-4">
            {report.general.map((c) => <CheckRow key={c.id} c={c} />)}
          </ul>
        </div>
      )}

      {inForce.length > 0 && (
        <div>
          <h2 className="mb-2 font-serif text-xl">Laws that apply</h2>
          <div className="space-y-2">{inForce.map((r) => <JurisdictionCard key={r.jurisdiction.id} r={r} />)}</div>
        </div>
      )}

      {other.length > 0 && (
        <div>
          <h2 className="mb-2 font-serif text-xl">Also relevant</h2>
          <div className="space-y-2">{other.map((r) => <JurisdictionCard key={r.jurisdiction.id} r={r} />)}</div>
        </div>
      )}

      {report.language.length > 0 && (
        <div>
          <h2 className="mb-2 font-serif text-xl">Wording to reconsider</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card px-4">
            {report.language.map((f) => (
              <li key={f.term} className="py-3 text-sm">
                <p>
                  <span className="rounded px-1.5 py-0.5 font-medium" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
                    {f.term}
                  </span>
                </p>
                <p className="mt-1 text-muted">{f.why}</p>
                <p className="mt-1"><span className="font-medium">Try:</span> {f.suggest}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function headline(r: Report): string {
  const s = r.summary;
  if (s.status === "fail") return `${s.failing} issue${s.failing === 1 ? "" : "s"} to fix`;
  if (s.status === "warn") return "Looks compliant, with items to review";
  if (s.status === "pass") return "Looks compliant";
  return "No posting laws apply";
}

function RewriteView({ result }: { result: AnalyzeResult }) {
  const [copied, setCopied] = useState(false);
  const before = result.report.summary;
  const after = result.rewriteReport.summary;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.rewrite.rewritten_posting);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl">Suggested rewrite</h2>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-line bg-card p-3">
          <p className="text-xs text-muted">Original</p>
          <p className="mt-1 flex items-center gap-2"><Badge status={before.status} /> {before.failing} to fix</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-3">
          <p className="text-xs text-muted">Rewrite, re-checked by the rules engine</p>
          <p className="mt-1 flex items-center gap-2"><Badge status={after.status} /> {after.failing} to fix</p>
        </div>
      </div>

      {result.placeholders.length > 0 && (
        <div className="rounded-xl p-4 text-sm" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
          <p className="font-medium">Fill in {result.placeholders.length} placeholder{result.placeholders.length === 1 ? "" : "s"} before posting</p>
          <p className="mt-1 opacity-90">
            We never invent pay, benefits or dates. Anything still showing &quot;to fix&quot; above is waiting on these:
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {result.placeholders.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="text-sm font-medium">Revised posting</span>
          <button type="button" onClick={copy} className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent hover:text-accent">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words p-4 font-sans text-sm leading-relaxed">
          {result.rewrite.rewritten_posting}
        </pre>
      </div>

      {result.rewrite.changes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">What changed</p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card px-4 text-sm">
            {result.rewrite.changes.map((c, i) => (
              <li key={i} className="py-2">
                <p>{c.what}</p>
                <p className="text-muted">{c.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Checker() {
  const [text, setText] = useState("");
  const [employees, setEmployees] = useState("");
  const [remoteUS, setRemoteUS] = useState<boolean | null>(null);
  const [extraStates, setExtraStates] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [payPeriod, setPayPeriod] = useState<"year" | "hour">("year");
  const [ai, setAi] = useState<AnalyzeResult | null>(null);
  const [aiKey, setAiKey] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const n = parseInt(employees, 10);
  const employeeCount = Number.isFinite(n) && n > 0 ? n : null;
  const inputKey = JSON.stringify([text, employeeCount, extraStates, remoteUS]);
  // An AI result is only shown while the inputs it was computed from are unchanged.
  const aiResult = ai && aiKey === inputKey ? ai : null;

  const report = useMemo(() => {
    if (!submitted || !text.trim()) return null;
    return evaluate({ text, employees: employeeCount, extraStates, remoteAnywhereUS: remoteUS ?? undefined });
  }, [submitted, text, employeeCount, extraStates, remoteUS]);

  const toggleState = (id: string) =>
    setExtraStates((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toNum = (s: string) => {
    const v = parseFloat(s.replace(/[$,\s]/g, ""));
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  async function runAi() {
    setAiLoading(true);
    setAiError(null);
    const min = toNum(payMin);
    const max = toNum(payMax);
    const key = inputKey;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          employees: employeeCount,
          extraStates,
          remoteAnywhereUS: remoteUS ?? undefined,
          pay: min && max && max >= min ? { min, max, period: payPeriod } : undefined,
        }),
      });
      const data = await res.json().catch(() => ({ error: "Unexpected response from the server." }));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setAi(data as AnalyzeResult);
      setAiKey(key);
      setSubmitted(true);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAiLoading(false);
    }
  }

  const shown = aiResult?.report ?? report;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* ---------- Input ---------- */}
      <section aria-label="Job posting" className="space-y-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="posting" className="text-sm font-medium">Job posting</label>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e.label}
                  type="button"
                  onClick={() => { setText(e.text); setSubmitted(true); setRemoteUS(null); }}
                  className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-accent"
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            id="posting"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            placeholder="Paste the full posting here: title, location, description, pay and benefits…"
            className="w-full resize-y rounded-xl border border-line bg-card p-4 text-sm leading-relaxed outline-none focus:border-accent"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="employees" className="mb-1 block text-sm font-medium">Employer size</label>
            <input
              id="employees"
              inputMode="numeric"
              value={employees}
              onChange={(e) => setEmployees(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Number of employees"
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs text-muted">Leave blank and we&apos;ll assume every law applies.</p>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Remote candidates</span>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--accent)]"
                checked={remoteUS ?? shown?.parsed.remote === "us-wide"}
                onChange={(e) => setRemoteUS(e.target.checked)}
              />
              <span>Open to remote candidates anywhere in the US</span>
            </label>
          </div>
        </div>

        <details className="rounded-xl border border-line bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">
            Other states this role can be done in{extraStates.length ? ` (${extraStates.length})` : ""}
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {POSTING_STATES.map((j) => {
              const on = extraStates.includes(j.id);
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => toggleState(j.id)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1 text-xs ${on ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:border-accent"}`}
                >
                  {j.name}
                </button>
              );
            })}
          </div>
        </details>

        <button
          type="button"
          onClick={() => setSubmitted(true)}
          disabled={!text.trim()}
          className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-40"
        >
          Check posting
        </button>

        {/* ---------- AI panel ---------- */}
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="font-serif text-lg">Fix it for me</p>
          <p className="mt-1 text-sm text-muted">
            Claude reads messy postings more reliably than the quick check and drafts a compliant rewrite. The rules
            engine still makes every pass/fail call, on your posting and on the rewrite.
          </p>

          <fieldset className="mt-3">
            <legend className="mb-1 text-sm font-medium">Pay range to use (optional)</legend>
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Minimum pay"
                inputMode="decimal"
                value={payMin}
                onChange={(e) => setPayMin(e.target.value)}
                placeholder="Min, e.g. 95000"
                className="w-32 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <span className="text-muted">–</span>
              <input
                aria-label="Maximum pay"
                inputMode="decimal"
                value={payMax}
                onChange={(e) => setPayMax(e.target.value)}
                placeholder="Max"
                className="w-32 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <select
                aria-label="Pay period"
                value={payPeriod}
                onChange={(e) => setPayPeriod(e.target.value as "year" | "hour")}
                className="rounded-lg border border-line bg-paper px-2 py-2 text-sm"
              >
                <option value="year">per year</option>
                <option value="hour">per hour</option>
              </select>
            </div>
            <p className="mt-1 text-xs text-muted">Without one, the rewrite leaves a placeholder. We never make up numbers.</p>
          </fieldset>

          <button
            type="button"
            onClick={runAi}
            disabled={!text.trim() || aiLoading}
            className="mt-4 w-full rounded-xl border border-accent px-5 py-3 text-sm font-semibold text-accent transition hover:bg-accent-soft disabled:opacity-40"
          >
            {aiLoading ? "Reading and rewriting…" : "Check with AI and draft a fix"}
          </button>
          {aiError && (
            <p role="alert" className="mt-2 text-sm" style={{ color: "var(--fail)" }}>{aiError}</p>
          )}
          <p className="mt-2 text-xs text-muted">
            This sends the posting text to Anthropic&apos;s Claude API to process it. PayClear doesn&apos;t store it.
          </p>
        </div>
      </section>

      {/* ---------- Report ---------- */}
      <section aria-label="Results" aria-live="polite" className="space-y-6">
        {!shown ? (
          <div className="rounded-xl border border-dashed border-line p-8 text-sm text-muted">
            <p className="font-serif text-xl text-ink">What you&apos;ll get</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Which state and city laws apply, based on location, remote eligibility and company size</li>
              <li>What each law requires: pay range, benefits, application deadline</li>
              <li>Red flags like open-ended or very wide ranges</li>
              <li>Exclusionary wording that narrows your applicant pool</li>
              <li>With &quot;Fix it for me&quot;: a rewritten posting, re-checked against the same rules</li>
            </ul>
          </div>
        ) : (
          <>
            {aiResult && <RewriteView result={aiResult} />}
            {aiResult && <h2 className="pt-2 font-serif text-2xl">Findings on your original</h2>}
            <ReportView report={shown} source={aiResult ? "ai" : "rules"} />
          </>
        )}
      </section>
    </div>
  );
}
