import { LOCAL_ALIASES, US_STATES } from "./jurisdictions";

export type PayPeriod = "hour" | "year" | "month" | "week" | "unknown";

export interface PayInfo {
  /** The raw text the range was read from. */
  raw: string;
  min: number;
  max: number | null;
  period: PayPeriod;
  /** True for "up to $X", "$X+", "starting at $X" — open-ended, not a range. */
  openEnded: boolean;
}

export interface ParsedPosting {
  pay: PayInfo | null;
  /** Phrases like "competitive salary" / "DOE" that signal a missing range. */
  vaguePayPhrases: string[];
  states: string[];
  locals: string[];
  remote: "us-wide" | "remote" | "none";
  mentionsBenefits: boolean;
  closeDate: string | null;
  wordCount: number;
}

const MONEY = String.raw`\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?([kK])?`;
const PERIOD = String.raw`(?:\s*(?:\/|per|an|a)\s*(hour|hr|year|yr|annum|annually|month|mo|week|wk))?`;
// The second figure's "$" is optional: "$80-120k".
const MONEY2 = String.raw`\$?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?([kK])?`;
const RANGE_RE = new RegExp(`${MONEY}${PERIOD}\\s*(?:-|–|—|to)\\s*${MONEY2}${PERIOD}`, "gi");
const SINGLE_RE = new RegExp(`(up to|starting at|starting from|from|at least|minimum of)?\\s*${MONEY}(\\+)?${PERIOD}`, "gi");

function toNumber(n: string, k?: string): number {
  const v = parseFloat(n.replace(/,/g, ""));
  return k ? v * 1000 : v;
}

function toPeriod(p: string | undefined, amount: number, context: string): PayPeriod {
  const s = (p ?? "").toLowerCase();
  if (/^(hour|hr)$/.test(s)) return "hour";
  if (/^(year|yr|annum|annually)$/.test(s)) return "year";
  if (/^(month|mo)$/.test(s)) return "month";
  if (/^(week|wk)$/.test(s)) return "week";
  const c = context.toLowerCase();
  if (/hourly|per hour|\/hr/.test(c)) return "hour";
  if (/annual|salary|per year|\/yr/.test(c)) return "year";
  // Fall back on magnitude: small numbers are almost always hourly.
  if (amount < 300) return "hour";
  if (amount >= 15000) return "year";
  return "unknown";
}

export function extractPay(text: string): PayInfo | null {
  RANGE_RE.lastIndex = 0;
  const range = RANGE_RE.exec(text);
  if (range) {
    const [raw, n1, k1, p1, n2, k2, p2] = range;
    let min = toNumber(n1, k1);
    const max = toNumber(n2, k2);
    // "$80-120k" → apply the k to both sides.
    if (!k1 && k2 && min < 1000 && max >= 1000) min = min * 1000;
    const ctx = text.slice(Math.max(0, range.index - 60), range.index + raw.length + 60);
    return { raw: raw.trim(), min, max, period: toPeriod(p2 ?? p1, max, ctx), openEnded: false };
  }

  SINGLE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SINGLE_RE.exec(text))) {
    const [raw, qualifier, n, k, plus, p] = m;
    const amount = toNumber(n, k);
    // Ignore tiny amounts that are probably not pay (e.g. "$5 stipend" is still pay, but "$1" rarely is).
    if (amount < 7) continue;
    const ctx = text.slice(Math.max(0, m.index - 60), m.index + raw.length + 60);
    // Skip dollar amounts that are clearly not wages (e.g. "$2M in funding", "$500 home-office stipend").
    if (/funding|raised|revenue|stipend|reimburs|bonus of|referral/i.test(ctx) && !/salary|pay|wage|compensation|rate/i.test(ctx)) continue;
    return {
      raw: raw.trim(),
      min: amount,
      max: null,
      period: toPeriod(p, amount, ctx),
      openEnded: Boolean(plus) || /up to|starting|from|at least|minimum/i.test(qualifier ?? ""),
    };
  }
  return null;
}

const VAGUE = [
  "competitive salary", "competitive pay", "competitive compensation", "salary negotiable",
  "commensurate with experience", "depending on experience", "doe", "dependent on experience",
  "market rate", "attractive salary", "pay is negotiable",
];

export function findVaguePay(text: string): string[] {
  const t = text.toLowerCase();
  return VAGUE.filter((p) => new RegExp(`\\b${p.replace(/ /g, "\\s+")}\\b`).test(t));
}

export function detectLocations(text: string): { states: string[]; locals: string[] } {
  const states = new Set<string>();
  const locals = new Set<string>();
  const lower = text.toLowerCase();

  for (const [code, name] of Object.entries(US_STATES)) {
    if (new RegExp(`\\b${name.toLowerCase()}\\b`).test(lower)) {
      // "Washington, DC" should not count as Washington State.
      if (code === "WA" && /washington,?\s*d\.?c\.?/i.test(text) && !/washington state/i.test(text)) continue;
      states.add(code);
    }
    // Codes only in the "City, ST" pattern to avoid matching words like "IN", "OR", "ME".
    if (new RegExp(`,\\s*${code}\\b(?!-)`).test(text)) states.add(code);
  }
  if (/washington,?\s*d\.?c\.?|\bD\.C\.\b/i.test(text)) states.add("DC");

  for (const [alias, id] of Object.entries(LOCAL_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(lower)) locals.add(id);
  }
  // A "New York, NY" location is New York City.
  if (/new york,\s*ny\b/i.test(text)) locals.add("NYC");
  // "Columbus" / "Albany" etc. exist in other states; keep a local only if its state also appears.
  const LOCAL_STATE: Record<string, string> = {
    NYC: "NY", WESTCHESTER: "NY", ALBANY: "NY", ITHACA: "NY", JERSEYCITY: "NJ",
    CLEVELAND: "OH", COLUMBUS: "OH", CINCINNATI: "OH", TOLEDO: "OH",
  };
  for (const id of [...locals]) {
    const st = LOCAL_STATE[id];
    if (id === "NYC" || id === "JERSEYCITY") { states.add(st); continue; }
    if (!states.has(st)) locals.delete(id);
  }
  return { states: [...states].sort(), locals: [...locals].sort() };
}

export function detectRemote(text: string): ParsedPosting["remote"] {
  const t = text.toLowerCase();
  if (/remote\s*(\(|-|–|—)?\s*(us|u\.s\.|usa|united states|anywhere)|anywhere in the (us|u\.s\.|united states)|fully remote|100% remote/.test(t))
    return "us-wide";
  if (/\bremote\b|work from home|wfh|hybrid/.test(t)) return "remote";
  return "none";
}

export function mentionsBenefits(text: string): boolean {
  return /benefit|health insurance|medical|dental|vision|401\s?\(?k\)?|retirement plan|paid time off|\bpto\b|parental leave|equity|stock options|bonus/i.test(text);
}

export function detectCloseDate(text: string): string | null {
  const m = text.match(
    /(?:application[s]?\s+(?:window\s+)?(?:will\s+)?(?:close|closes|closing|deadline|due)|apply by|accepting applications (?:until|through)|deadline(?: to apply)?)[^.\n]{0,40}?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})/i,
  );
  return m ? m[1] : null;
}

export function parsePosting(text: string): ParsedPosting {
  const { states, locals } = detectLocations(text);
  return {
    pay: extractPay(text),
    vaguePayPhrases: findVaguePay(text),
    states,
    locals,
    remote: detectRemote(text),
    mentionsBenefits: mentionsBenefits(text),
    closeDate: detectCloseDate(text),
    wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
  };
}
