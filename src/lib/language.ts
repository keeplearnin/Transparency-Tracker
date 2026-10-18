/**
 * Inclusive-language checks. These are suggestions, not legal findings —
 * the wording lists are deliberately short and high-signal.
 */

export interface LanguageFinding {
  term: string;
  category: "age" | "gendered" | "ability" | "jargon" | "exclusionary";
  why: string;
  suggest: string;
}

const RULES: { re: RegExp; f: Omit<LanguageFinding, "term"> }[] = [
  { re: /\b(young|youthful)\b/i, f: { category: "age", why: "Signals an age preference, which can deter older applicants and create age-discrimination risk.", suggest: "Describe the work, not the person (e.g. \"energetic team\" → \"fast-moving team\")." } },
  { re: /\bdigital natives?\b/i, f: { category: "age", why: "Commonly read as a proxy for age.", suggest: "Name the actual skills, e.g. \"comfortable with modern collaboration tools\"." } },
  { re: /\brecent (college )?grad(uate)?s?\b/i, f: { category: "age", why: "Can exclude career changers and older applicants unless it is a formal new-graduate program.", suggest: "\"Early-career\" or \"0–2 years of experience\"." } },
  { re: /\bno more than \d+ years of experience\b/i, f: { category: "age", why: "Experience caps can screen out older workers.", suggest: "State the minimum you need, not a maximum." } },
  { re: /\b(salesman|salesmen|chairman|foreman|manpower)\b/i, f: { category: "gendered", why: "Gendered job language narrows the applicant pool.", suggest: "Use neutral terms: salesperson, chair, supervisor, staffing." } },
  { re: /\b(he|him|his)\s+(will|must|should)\b/i, f: { category: "gendered", why: "Assumes the hire's gender.", suggest: "Use \"you\" or \"they\"." } },
  { re: /\b(rock ?star|ninja|guru|superstar|crush(ing)? it)\b/i, f: { category: "jargon", why: "Hype jargon tends to discourage qualified applicants who don't self-describe that way.", suggest: "Describe the level of skill plainly, e.g. \"expert in…\"." } },
  { re: /\b(aggressive|dominant|dominate)\b/i, f: { category: "gendered", why: "Masculine-coded words measurably reduce applications from women.", suggest: "\"Ambitious\", \"proactive\", \"leads\"." } },
  { re: /\bnative (english )?speakers?\b/i, f: { category: "exclusionary", why: "Can amount to national-origin discrimination.", suggest: "\"Fluent in English\" or the specific proficiency needed." } },
  { re: /\b(must be able to (stand|walk|lift)|able-bodied)\b/i, f: { category: "ability", why: "Physical requirements should be essential job functions, stated with accommodation language.", suggest: "Keep only essential requirements and add \"with or without reasonable accommodation\"." } },
  { re: /\bclean[- ]cut\b|\bwell[- ]groomed\b/i, f: { category: "exclusionary", why: "Appearance standards can carry racial or religious bias.", suggest: "Remove, or state a specific, job-related dress requirement." } },
  { re: /\bculture fit\b/i, f: { category: "exclusionary", why: "Vague \"fit\" language invites bias in screening.", suggest: "Name the values or behaviors you actually assess." } },
];

export function checkLanguage(text: string): LanguageFinding[] {
  const out: LanguageFinding[] = [];
  for (const { re, f } of RULES) {
    const m = text.match(re);
    if (m) out.push({ term: m[0], ...f });
  }
  return out;
}
