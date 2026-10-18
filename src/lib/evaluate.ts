import { JURISDICTIONS, type Jurisdiction } from "./jurisdictions";
import { checkLanguage, type LanguageFinding } from "./language";
import { parsePosting, type ParsedPosting } from "./parse";

export type Status = "pass" | "fail" | "warn" | "info";

export interface Check {
  id: string;
  label: string;
  status: Status;
  detail: string;
}

export interface JurisdictionResult {
  jurisdiction: Jurisdiction;
  /** Why this jurisdiction applies (detected location, remote, user-selected). */
  reason: string;
  /** "in-force" | "upcoming" | "below-threshold" | "on-request" */
  applicability: "in-force" | "upcoming" | "below-threshold" | "on-request";
  checks: Check[];
  status: Status;
}

export interface CheckInput {
  text: string;
  /** Employer headcount. Null means unknown — we assume covered (the conservative choice). */
  employees: number | null;
  /** States the user says the role can be performed in, in addition to what we detect. */
  extraStates?: string[];
  /** Override remote detection. */
  remoteAnywhereUS?: boolean;
  today?: Date;
}

export interface Report {
  parsed: ParsedPosting;
  results: JurisdictionResult[];
  general: Check[];
  language: LanguageFinding[];
  summary: { status: Status; failing: number; warnings: number; covered: number };
}

const fmtMoney = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(n % 1 ? 2 : 0)}`;

function worst(statuses: Status[]): Status {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  if (statuses.includes("pass")) return "pass";
  return "info";
}

function payChecks(p: ParsedPosting, j: Jurisdiction): Check[] {
  const checks: Check[] = [];
  const singleOk = j.id === "NJ"; // NJ accepts a single wage or salary.

  if (!p.pay) {
    checks.push({
      id: "range", label: "Pay range in posting", status: "fail",
      detail: p.vaguePayPhrases.length
        ? `Says "${p.vaguePayPhrases[0]}" but gives no numbers. ${j.name} requires an actual range.`
        : `No pay figure found. ${j.name} requires a pay range in the posting.`,
    });
  } else if (p.pay.openEnded) {
    checks.push({
      id: "range", label: "Pay range in posting", status: "fail",
      detail: `"${p.pay.raw}" is open-ended. ${j.name} expects a minimum and a maximum.`,
    });
  } else if (p.pay.max === null) {
    checks.push({
      id: "range", label: "Pay range in posting", status: singleOk ? "pass" : "warn",
      detail: singleOk
        ? `Single figure "${p.pay.raw}" is acceptable in New Jersey.`
        : `Single figure "${p.pay.raw}". Most laws expect a range; a single figure is usually fine only if it is the exact pay.`,
    });
  } else {
    checks.push({
      id: "range", label: "Pay range in posting", status: "pass",
      detail: `Found ${fmtMoney(p.pay.min)}–${fmtMoney(p.pay.max)}${p.pay.period !== "unknown" ? ` per ${p.pay.period}` : ""}.`,
    });
  }

  if (j.requires.benefits) {
    checks.push({
      id: "benefits", label: "General description of benefits", status: p.mentionsBenefits ? "pass" : "fail",
      detail: p.mentionsBenefits
        ? "Benefits are mentioned."
        : `${j.name} requires a general description of benefits and other compensation.`,
    });
  }
  if (j.requires.closeDate) {
    checks.push({
      id: "close", label: "Application deadline", status: p.closeDate ? "pass" : "fail",
      detail: p.closeDate
        ? `Deadline found: ${p.closeDate}.`
        : `${j.name} requires the date the application window is expected to close.`,
    });
  }
  if (j.requires.jobDescription) {
    const ok = p.wordCount >= 80;
    checks.push({
      id: "jd", label: "Job description", status: ok ? "pass" : "warn",
      detail: ok
        ? "Posting includes a description of the role."
        : `${j.name} requires the job description, if one exists. This posting is very short.`,
    });
  }
  return checks;
}

export function evaluate(input: CheckInput): Report {
  const today = input.today ?? new Date();
  const parsed = parsePosting(input.text);
  const remoteUS = input.remoteAnywhereUS ?? parsed.remote === "us-wide";

  // Which jurisdictions could this posting touch, and why?
  const reasons = new Map<string, string>();
  for (const s of parsed.states) reasons.set(s, "Location mentioned in the posting");
  for (const l of parsed.locals) reasons.set(l, "City or county mentioned in the posting");
  for (const s of input.extraStates ?? []) if (!reasons.has(s)) reasons.set(s, "You said the role can be performed here");
  if (remoteUS) {
    for (const j of JURISDICTIONS) {
      if (j.level === "state" && !reasons.has(j.id))
        reasons.set(j.id, "Remote role open across the US — most state laws cover remote hires in that state");
    }
  }

  const results: JurisdictionResult[] = [];
  for (const j of JURISDICTIONS) {
    const reason = reasons.get(j.id);
    if (!reason) continue;

    let applicability: JurisdictionResult["applicability"] = "in-force";
    if (j.kind === "on-request") applicability = "on-request";
    else if (new Date(j.effective) > today) applicability = "upcoming";
    else if (input.employees !== null && input.employees < j.minEmployees) applicability = "below-threshold";

    let checks: Check[] = [];
    if (applicability === "on-request") {
      checks = [{
        id: "on-request", label: "Disclosure on request", status: "info",
        detail: `${j.name} doesn't require the range in the posting, but ${j.coverage.charAt(0).toLowerCase()}${j.coverage.slice(1)}`,
      }];
    } else if (applicability === "below-threshold") {
      checks = [{
        id: "threshold", label: "Employer size", status: "info",
        detail: `Applies to employers with ${j.minEmployees}+ employees. ${j.headcountNote ?? ""} You entered ${input.employees}.`.trim(),
      }];
    } else {
      checks = payChecks(parsed, j);
      if (applicability === "upcoming") {
        // Report what will fail, but as warnings until the law is in force.
        checks = checks.map((c) => (c.status === "fail" ? { ...c, status: "warn" as Status } : c));
        checks.unshift({
          id: "upcoming", label: "Not yet in force", status: "info",
          detail: `Takes effect ${j.effective}. Fix these now so the posting doesn't need changing later.`,
        });
      }
    }

    results.push({ jurisdiction: j, reason, applicability, checks, status: worst(checks.map((c) => c.status)) });
  }

  // Checks that apply regardless of jurisdiction.
  const general: Check[] = [];
  if (parsed.pay && parsed.pay.max !== null) {
    const ratio = parsed.pay.max / parsed.pay.min;
    if (parsed.pay.max < parsed.pay.min) {
      general.push({ id: "order", label: "Range order", status: "fail", detail: "The maximum is lower than the minimum." });
    } else if (ratio > 2) {
      general.push({
        id: "width", label: "Good-faith range", status: "warn",
        detail: `The top of the range is ${ratio.toFixed(1)}× the bottom. Most laws require a good-faith estimate of what you expect to pay; very wide ranges draw scrutiny.`,
      });
    } else {
      general.push({ id: "width", label: "Good-faith range", status: "pass", detail: `Range width looks reasonable (top is ${ratio.toFixed(1)}× the bottom).` });
    }
  }
  if (parsed.pay?.period === "hour" && parsed.pay.min < 7.25) {
    general.push({ id: "minwage", label: "Minimum wage", status: "fail", detail: "The hourly figure is below the federal minimum wage of $7.25." });
  }
  if (parsed.pay?.period === "unknown") {
    general.push({ id: "period", label: "Pay period", status: "warn", detail: "We couldn't tell if this is hourly or annual. State the period, e.g. \"per year\"." });
  }
  if (parsed.states.length === 0 && parsed.locals.length === 0 && parsed.remote === "none" && !(input.extraStates?.length)) {
    general.push({ id: "location", label: "Work location", status: "warn", detail: "No work location found, so we can't tell which laws apply. Add a location or pick states below." });
  }
  if (parsed.remote === "remote" && !remoteUS) {
    general.push({
      id: "remote", label: "Remote eligibility", status: "warn",
      detail: "The posting mentions remote work but not where. If people in any pay-transparency state can apply, those states' rules apply too. Tick \"open to remote candidates anywhere in the US\" to check them all.",
    });
  }

  const language = checkLanguage(input.text);
  const allChecks = [...results.flatMap((r) => r.checks), ...general];
  const failing = allChecks.filter((c) => c.status === "fail").length;
  const warnings = allChecks.filter((c) => c.status === "warn").length + language.length;
  return {
    parsed,
    results: results.sort((a, b) => rank(a) - rank(b)),
    general,
    language,
    summary: {
      status: failing ? "fail" : warnings ? "warn" : results.some((r) => r.applicability === "in-force") ? "pass" : "info",
      failing, warnings,
      covered: results.filter((r) => r.applicability === "in-force").length,
    },
  };
}

function rank(r: JurisdictionResult): number {
  const a = { "in-force": 0, upcoming: 1, "below-threshold": 2, "on-request": 3 }[r.applicability];
  const s = { fail: 0, warn: 1, pass: 2, info: 3 }[r.status];
  return a * 10 + s;
}
