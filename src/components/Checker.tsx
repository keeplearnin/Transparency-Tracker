"use client";

import { useMemo, useState } from "react";
import { evaluate, type Check, type JurisdictionResult, type Status } from "@/lib/evaluate";
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

export default function Checker() {
  const [text, setText] = useState("");
  const [employees, setEmployees] = useState("");
  const [remoteUS, setRemoteUS] = useState<boolean | null>(null);
  const [extraStates, setExtraStates] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const report = useMemo(() => {
    if (!submitted || !text.trim()) return null;
    const n = parseInt(employees, 10);
    return evaluate({
      text,
      employees: Number.isFinite(n) && n > 0 ? n : null,
      extraStates,
      remoteAnywhereUS: remoteUS ?? undefined,
    });
  }, [submitted, text, employees, extraStates, remoteUS]);

  const toggleState = (id: string) =>
    setExtraStates((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const inForce = report?.results.filter((r) => r.applicability === "in-force") ?? [];
  const other = report?.results.filter((r) => r.applicability !== "in-force") ?? [];

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
                checked={remoteUS ?? report?.parsed.remote === "us-wide"}
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
      </section>

      {/* ---------- Report ---------- */}
      <section aria-label="Results" aria-live="polite" className="space-y-6">
        {!report ? (
          <div className="rounded-xl border border-dashed border-line p-8 text-sm text-muted">
            <p className="font-serif text-xl text-ink">What you&apos;ll get</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Which state and city laws apply, based on location, remote eligibility and company size</li>
              <li>What each law requires: pay range, benefits, application deadline</li>
              <li>Red flags like open-ended or very wide ranges</li>
              <li>Exclusionary wording that narrows your applicant pool</li>
            </ul>
          </div>
        ) : (
          <>
            <div
              className="rounded-xl p-5"
              style={{ background: STATUS_STYLE[report.summary.status].bg, color: STATUS_STYLE[report.summary.status].fg }}
            >
              <p className="font-serif text-2xl">
                {report.summary.status === "fail" && `${report.summary.failing} issue${report.summary.failing === 1 ? "" : "s"} to fix`}
                {report.summary.status === "warn" && "Looks compliant, with items to review"}
                {report.summary.status === "pass" && "Looks compliant"}
                {report.summary.status === "info" && "No posting laws apply"}
              </p>
              <p className="mt-1 text-sm opacity-90">
                {report.summary.covered} law{report.summary.covered === 1 ? "" : "s"} in force for this posting
                {report.summary.warnings ? ` · ${report.summary.warnings} item${report.summary.warnings === 1 ? "" : "s"} to review` : ""}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-card px-4 py-3 text-sm">
              <p className="mb-1 font-medium">What we read</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted">
                <dt>Pay</dt>
                <dd className="text-ink">{report.parsed.pay ? report.parsed.pay.raw : "None found"}</dd>
                <dt>Locations</dt>
                <dd className="text-ink">
                  {[...report.parsed.states, ...report.parsed.locals].join(", ") || "None found"}
                </dd>
                <dt>Remote</dt>
                <dd className="text-ink">
                  {{ "us-wide": "Remote, US-wide", remote: "Remote/hybrid, region unclear", none: "Not mentioned" }[report.parsed.remote]}
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
        )}
      </section>
    </div>
  );
}
