"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { AnalyzeResult } from "@/lib/ai";
import { evaluate, type Check, type JurisdictionResult, type Report, type Status } from "@/lib/evaluate";
import { JURISDICTIONS } from "@/lib/jurisdictions";

/* ------------------------------------------------------------------ data */

const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "No pay listed",
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
    label: "Hourly role",
    text: `Warehouse Associate — Newark, NJ

Pick, pack and ship customer orders in our Newark fulfillment center. Full-time, day shift.
Must be able to lift 50 lbs.

Pay: $21/hour. Health benefits, paid time off and weekly pay.`,
  },
];

const POSTING_STATES = JURISDICTIONS.filter((j) => j.level === "state").sort((a, b) => a.name.localeCompare(b.name));

const STATUS: Record<Status, { label: string; fg: string; bg: string }> = {
  pass: { label: "Pass", fg: "var(--pass)", bg: "var(--pass-bg)" },
  warn: { label: "Review", fg: "var(--warn)", bg: "var(--warn-bg)" },
  fail: { label: "Fix", fg: "var(--fail)", bg: "var(--fail-bg)" },
  info: { label: "Note", fg: "var(--info)", bg: "var(--info-bg)" },
};

const APPLICABILITY: Record<JurisdictionResult["applicability"], string> = {
  "in-force": "In force",
  upcoming: "Takes effect later",
  "below-threshold": "Below size threshold",
  "on-request": "Disclose on request",
};

/* ------------------------------------------------------------- primitives */

function StatusIcon({ status, size = 16 }: { status: Status; size?: number }) {
  const c = STATUS[status].fg;
  const paths: Record<Status, ReactNode> = {
    pass: <path d="M5 8.5l2 2 4-4.5" />,
    warn: <><path d="M8 4.75v4" /><path d="M8 11.25v.01" /></>,
    fail: <><path d="M5.75 5.75l4.5 4.5" /><path d="M10.25 5.75l-4.5 4.5" /></>,
    info: <><path d="M8 7.5v3.75" /><path d="M8 4.75v.01" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-label={STATUS[status].label} role="img" className="shrink-0">
      <circle cx="8" cy="8" r="8" fill={STATUS[status].bg} />
      <g fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[status]}</g>
    </svg>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface ${className}`} style={{ boxShadow: "var(--shadow)" }}>
      {children}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left text-sm"
    >
      <span
        className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? "var(--accent)" : "var(--line-strong)" }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
        />
      </span>
      {label}
    </button>
  );
}

/* --------------------------------------------------------- annotated text */

type Mark = { start: number; end: number; kind: "fail" | "warn" | "pass"; note: string };

function findAll(text: string, needle: string): number[] {
  if (!needle.trim()) return [];
  const out: number[] = [];
  const hay = text.toLowerCase();
  const n = needle.toLowerCase();
  for (let i = hay.indexOf(n); i !== -1; i = hay.indexOf(n, i + n.length)) out.push(i);
  return out;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMarks(text: string, report: Report): Mark[] {
  const marks: Mark[] = [];
  const p = report.parsed.pay;
  if (p) {
    const ok = !p.openEnded;
    for (const i of findAll(text, p.raw)) {
      marks.push({ start: i, end: i + p.raw.length, kind: ok ? "pass" : "fail", note: ok ? "Pay found" : "Open-ended pay: give a minimum and maximum" });
    }
  }
  for (const v of report.parsed.vaguePayPhrases) {
    const re = new RegExp(escapeRe(v).replace(/\s+/g, "\\s+"), "gi");
    for (const m of text.matchAll(re)) marks.push({ start: m.index!, end: m.index! + m[0].length, kind: "fail", note: "Not a pay range" });
  }
  for (const f of report.language) {
    for (const i of findAll(text, f.term)) marks.push({ start: i, end: i + f.term.length, kind: "warn", note: f.why });
  }
  marks.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Mark[] = [];
  for (const m of marks) if (!out.length || m.start >= out[out.length - 1].end) out.push(m);
  return out;
}

function Annotated({ text, report }: { text: string; report: Report }) {
  const marks = buildMarks(text, report);
  const parts: ReactNode[] = [];
  let at = 0;
  marks.forEach((m, i) => {
    if (m.start > at) parts.push(text.slice(at, m.start));
    parts.push(
      <mark key={i} className={`m-${m.kind}`} title={m.note}>
        {text.slice(m.start, m.end)}
      </mark>,
    );
    at = m.end;
  });
  parts.push(text.slice(at));
  return <div className="whitespace-pre-wrap break-words text-[15px] leading-7">{parts}</div>;
}

/* ---------------------------------------------------------------- results */

function CheckRow({ c }: { c: Check }) {
  return (
    <li className="flex gap-3 py-2.5">
      <span className="mt-0.5"><StatusIcon status={c.status} /></span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{c.label}</p>
        <p className="text-sm text-ink-2">{c.detail}</p>
      </div>
    </li>
  );
}

function JurisdictionRow({ r, open, onToggle }: { r: JurisdictionResult; open: boolean; onToggle: () => void }) {
  const j = r.jurisdiction;
  return (
    <div id={`j-${j.id}`} className="scroll-mt-24">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken"
      >
        <StatusIcon status={r.status} size={18} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{j.name}</span>
          <span className="block truncate text-xs text-ink-3">{APPLICABILITY[r.applicability]}. {r.reason}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className={`shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="reveal border-t border-line bg-sunken px-4 pb-4 pt-1">
          <ul className="divide-y divide-line">{r.checks.map((c) => <CheckRow key={c.id} c={c} />)}</ul>
          <p className="mt-2 text-xs leading-relaxed text-ink-2">
            {j.coverage}
            {j.notes ? ` ${j.notes}` : ""}
          </p>
          <p className="mt-2 text-xs text-ink-3">
            Effective {j.effective}, {j.minEmployees > 1 ? `${j.minEmployees}+ employees` : "any employer"}. Source:{" "}
            {j.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ", "}
                <a href={s.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
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

function headline(r: Report): string {
  const s = r.summary;
  if (s.status === "fail") return `${s.failing} ${s.failing === 1 ? "issue" : "issues"} to fix`;
  if (s.status === "warn") return "Compliant, with items to review";
  if (s.status === "pass") return "Compliant";
  return "No posting laws apply";
}

function Findings({ report }: { report: Report }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(report.results.map((r) => [r.jurisdiction.id, r.applicability === "in-force" && r.status === "fail"])),
  );
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const jump = (id: string) => {
    setOpen((o) => ({ ...o, [id]: true }));
    requestAnimationFrame(() => document.getElementById(`j-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const inForce = report.results.filter((r) => r.applicability === "in-force");
  const other = report.results.filter((r) => r.applicability !== "in-force");
  const st = STATUS[report.summary.status];

  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden">
        <div className="flex items-start gap-3 p-5" style={{ background: st.bg }}>
          <StatusIcon status={report.summary.status} size={28} />
          <div>
            <p className="text-xl font-semibold tracking-tight" style={{ color: st.fg }}>{headline(report)}</p>
            <p className="mt-0.5 text-sm text-ink-2">
              {report.summary.covered} {report.summary.covered === 1 ? "law applies" : "laws apply"}
              {report.summary.warnings ? `, ${report.summary.warnings} ${report.summary.warnings === 1 ? "item" : "items"} to review` : ""}
            </p>
          </div>
        </div>
        {report.results.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-line px-5 py-3">
            {report.results.map((r) => (
              <button
                key={r.jurisdiction.id}
                type="button"
                onClick={() => jump(r.jurisdiction.id)}
                title={`${r.jurisdiction.name}: ${STATUS[r.status].label}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium hover:border-line-strong"
                style={{ opacity: r.applicability === "in-force" ? 1 : 0.6 }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS[r.status].fg }} />
                {r.jurisdiction.level === "state" ? r.jurisdiction.id : r.jurisdiction.name.split(",")[0]}
              </button>
            ))}
          </div>
        )}
      </Panel>

      {report.general.length > 0 && (
        <Panel className="px-4">
          <ul className="divide-y divide-line">{report.general.map((c) => <CheckRow key={c.id} c={c} />)}</ul>
        </Panel>
      )}

      {inForce.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-sm font-semibold text-ink-2">Laws that apply</h3>
          <Panel className="divide-y divide-line overflow-hidden">
            {inForce.map((r) => <JurisdictionRow key={r.jurisdiction.id} r={r} open={!!open[r.jurisdiction.id]} onToggle={() => toggle(r.jurisdiction.id)} />)}
          </Panel>
        </section>
      )}

      {other.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-sm font-semibold text-ink-2">Also relevant</h3>
          <Panel className="divide-y divide-line overflow-hidden">
            {other.map((r) => <JurisdictionRow key={r.jurisdiction.id} r={r} open={!!open[r.jurisdiction.id]} onToggle={() => toggle(r.jurisdiction.id)} />)}
          </Panel>
        </section>
      )}

      {report.language.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-sm font-semibold text-ink-2">Wording to reconsider</h3>
          <Panel className="divide-y divide-line">
            {report.language.map((f) => (
              <div key={f.term} className="px-4 py-3 text-sm">
                <p className="font-medium">
                  <mark className="m-warn px-0.5">{f.term}</mark>
                </p>
                <p className="mt-1 text-ink-2">{f.why}</p>
                <p className="mt-1">Try: {f.suggest}</p>
              </div>
            ))}
          </Panel>
        </section>
      )}
    </div>
  );
}

function Rewrite({ result }: { result: AnalyzeResult }) {
  const [copied, setCopied] = useState(false);
  const before = result.report.summary;
  const after = result.rewriteReport.summary;
  const blanks = result.placeholders.length > 0;
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
      <Panel className="grid grid-cols-2 divide-x divide-line">
        <div className="flex items-center gap-3 p-4">
          <StatusIcon status={before.status} size={22} />
          <div>
            <p className="text-xs text-ink-3">Your posting</p>
            <p className="tnum text-sm font-semibold">{before.failing === 0 ? "Nothing to fix" : `${before.failing} to fix`}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <StatusIcon status={after.failing && blanks ? "warn" : after.status} size={22} />
          <div>
            <p className="text-xs text-ink-3">Rewrite</p>
            <p className="tnum text-sm font-semibold">
              {after.failing === 0 ? "Nothing to fix" : blanks ? "Clears once blanks are filled" : `${after.failing} to fix`}
            </p>
          </div>
        </div>
      </Panel>

      {result.placeholders.length > 0 && (
        <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--warn-bg)" }}>
          <p className="font-semibold" style={{ color: "var(--warn)" }}>
            Fill in {result.placeholders.length} {result.placeholders.length === 1 ? "blank" : "blanks"} before you post
          </p>
          <p className="mt-0.5 text-ink-2">Pay, benefits and dates are never made up. Remaining issues clear once these are filled.</p>
          <ul className="mt-2 space-y-1">
            {result.placeholders.map((p) => (
              <li key={p} className="font-medium text-ink">{p}</li>
            ))}
          </ul>
        </div>
      )}

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm font-semibold">Revised posting</span>
          <button
            type="button"
            onClick={copy}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:border-line-strong"
          >
            {copied ? "Copied" : "Copy text"}
          </button>
        </div>
        <pre className="max-h-[30rem] overflow-auto whitespace-pre-wrap break-words p-4 font-sans text-[15px] leading-7">
          {result.rewrite.rewritten_posting}
        </pre>
      </Panel>

      {result.rewrite.changes.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-sm font-semibold text-ink-2">What changed</h3>
          <Panel className="divide-y divide-line">
            {result.rewrite.changes.map((c, i) => (
              <div key={i} className="px-4 py-3 text-sm">
                <p className="font-medium">{c.what}</p>
                <p className="text-ink-2">{c.why}</p>
              </div>
            ))}
          </Panel>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- main */

export default function Checker() {
  const [text, setText] = useState("");
  const [employees, setEmployees] = useState("");
  const [remoteUS, setRemoteUS] = useState<boolean | null>(null);
  const [extraStates, setExtraStates] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<"edit" | "review">("edit");
  const [tab, setTab] = useState<"findings" | "rewrite">("findings");

  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [payPeriod, setPayPeriod] = useState<"year" | "hour">("year");
  const [ai, setAi] = useState<AnalyzeResult | null>(null);
  const [aiKey, setAiKey] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  const n = parseInt(employees, 10);
  const employeeCount = Number.isFinite(n) && n > 0 ? n : null;
  const inputKey = JSON.stringify([text, employeeCount, extraStates, remoteUS]);
  const aiResult = ai && aiKey === inputKey ? ai : null;

  const report = useMemo(() => {
    if (!submitted || !text.trim()) return null;
    return evaluate({ text, employees: employeeCount, extraStates, remoteAnywhereUS: remoteUS ?? undefined });
  }, [submitted, text, employeeCount, extraStates, remoteUS]);
  const shown = aiResult?.report ?? report;

  const toggleState = (id: string) => setExtraStates((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toNum = (s: string) => {
    const v = parseFloat(s.replace(/[$,\s]/g, ""));
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  function showResults() {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  function check() {
    setSubmitted(true);
    setMode("review");
    setTab("findings");
    showResults();
  }

  async function fix() {
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
      const data = await res.json().catch(() => ({ error: "The server sent an unexpected response. Try again." }));
      if (!res.ok) throw new Error(data.error ?? "The rewrite didn't complete. Try again.");
      setAi(data as AnalyzeResult);
      setAiKey(key);
      setSubmitted(true);
      setMode("review");
      setTab("rewrite");
      showResults();
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "The rewrite didn't complete. Try again.");
    } finally {
      setAiLoading(false);
    }
  }

  const canReview = Boolean(shown);
  const viewing = mode === "review" && canReview ? "review" : "edit";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
      {/* ------------------------------ left: posting + settings */}
      <section aria-label="Job posting" className="space-y-4">
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <div role="tablist" aria-label="Posting view" className="flex rounded-lg bg-sunken p-0.5 text-sm">
              {(["edit", "review"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  type="button"
                  aria-selected={viewing === m}
                  disabled={m === "review" && !canReview}
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1 font-medium transition-colors disabled:opacity-40 ${
                    viewing === m ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {m === "edit" ? "Edit" : "Highlights"}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-3">
              Try a sample
              <select
                value=""
                onChange={(e) => {
                  const ex = EXAMPLES[Number(e.target.value)];
                  if (!ex || e.target.value === "") return;
                  setText(ex.text);
                  setRemoteUS(null);
                  setSubmitted(true);
                  setMode("review");
                  setTab("findings");
                }}
                className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink"
              >
                <option value="">Choose…</option>
                {EXAMPLES.map((e, i) => <option key={e.label} value={i}>{e.label}</option>)}
              </select>
            </label>
          </div>

          {viewing === "edit" ? (
            <textarea
              aria-label="Job posting text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={15}
              placeholder="Paste the full posting: title, location, description, pay and benefits."
              className="block w-full resize-y bg-surface px-4 py-3 text-[15px] leading-7 outline-none placeholder:text-ink-3"
            />
          ) : (
            <div className="max-h-[34rem] min-h-[22rem] overflow-auto px-4 py-3">
              <Annotated text={text} report={shown!} />
            </div>
          )}

          <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-ink-3">
            <span className="tnum">{words} words</span>
            {viewing === "review" && (
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1"><mark className="m-fail">abc</mark> fix</span>
                <span className="flex items-center gap-1"><mark className="m-warn">abc</mark> review</span>
                <span className="flex items-center gap-1"><mark className="m-pass">abc</mark> ok</span>
              </span>
            )}
          </div>
        </Panel>

        <Panel className="divide-y divide-line">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div>
              <label htmlFor="employees" className="mb-1.5 block text-sm font-medium">Employees</label>
              <input
                id="employees"
                inputMode="numeric"
                value={employees}
                onChange={(e) => setEmployees(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="e.g. 120"
                className="tnum w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <p className="mt-1 text-xs text-ink-3">Blank means every law is checked.</p>
            </div>
            <div className="sm:pt-7">
              <Switch
                checked={remoteUS ?? shown?.parsed.remote === "us-wide"}
                onChange={(v) => setRemoteUS(v)}
                label="Remote hires anywhere in the US"
              />
            </div>
          </div>
          <details className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
              <span>
                More states the role can be done in
                {extraStates.length > 0 && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">{extraStates.length}</span>}
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-ink-3 transition-transform group-open:rotate-180">
                <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {POSTING_STATES.map((j) => {
                const on = extraStates.includes(j.id);
                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => toggleState(j.id)}
                    aria-pressed={on}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      on ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2 hover:border-line-strong"
                    }`}
                  >
                    {j.name}
                  </button>
                );
              })}
            </div>
          </details>
        </Panel>

        <button
          type="button"
          onClick={check}
          disabled={!text.trim()}
          className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Check posting
        </button>

        <Panel className="p-4">
          <p className="text-sm font-semibold">Fix with AI</p>
          <p className="mt-0.5 text-sm text-ink-2">
            Get a rewritten posting that addresses every finding, re-checked against the same rules.
          </p>
          <p className="mt-3 mb-1.5 text-sm font-medium">Pay range <span className="font-normal text-ink-3">(optional)</span></p>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              aria-label="Minimum pay"
              inputMode="decimal"
              value={payMin}
              onChange={(e) => setPayMin(e.target.value)}
              placeholder="Min"
              className="tnum min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              aria-label="Maximum pay"
              inputMode="decimal"
              value={payMax}
              onChange={(e) => setPayMax(e.target.value)}
              placeholder="Max"
              className="tnum min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <select
              aria-label="Pay period"
              value={payPeriod}
              onChange={(e) => setPayPeriod(e.target.value as "year" | "hour")}
              className="rounded-lg border border-line bg-surface px-2 py-2 text-sm"
            >
              <option value="year">per year</option>
              <option value="hour">per hour</option>
            </select>
          </div>
          <p className="mt-1.5 text-xs text-ink-3">Without it, the rewrite leaves a blank for you to fill in.</p>
          <button
            type="button"
            onClick={fix}
            disabled={!text.trim() || aiLoading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {aiLoading && (
              <svg width="14" height="14" viewBox="0 0 14 14" className="animate-spin" aria-hidden>
                <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
                <path d="M12.5 7A5.5 5.5 0 0 0 7 1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            {aiLoading ? "Rewriting…" : "Rewrite posting"}
          </button>
          {aiError && <p role="alert" className="mt-2 text-sm" style={{ color: "var(--fail)" }}>{aiError}</p>}
          <p className="mt-2 text-xs text-ink-3">Sends the posting text to Anthropic&apos;s API for processing. Nothing is stored.</p>
        </Panel>
      </section>

      {/* ------------------------------ right: results */}
      <section ref={resultsRef} aria-label="Results" aria-live="polite" className="scroll-mt-6">
        {!shown ? (
          <div className="rounded-2xl border border-dashed border-line-strong p-8">
            <p className="text-base font-semibold">Results appear here</p>
            <ul className="mt-3 space-y-2.5 text-sm text-ink-2">
              {[
                "Which state and city laws apply, from the location, remote eligibility and company size",
                "What each law needs in the posting: pay range, benefits, application deadline",
                "Problems in the text itself, highlighted where they occur",
                "A rewritten posting you can copy, checked against the same rules",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="reveal space-y-4">
            {aiResult && (
              <div role="tablist" aria-label="Results view" className="inline-flex rounded-xl border border-line bg-surface p-1 text-sm" style={{ boxShadow: "var(--shadow)" }}>
                {(["findings", "rewrite"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    type="button"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`rounded-lg px-4 py-1.5 font-medium transition-colors ${tab === t ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"}`}
                  >
                    {t === "findings" ? "Findings" : "Rewrite"}
                  </button>
                ))}
              </div>
            )}
            {aiResult && tab === "rewrite" ? (
              <Rewrite result={aiResult} />
            ) : (
              <Findings key={inputKey + (aiResult ? "ai" : "")} report={shown} />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
