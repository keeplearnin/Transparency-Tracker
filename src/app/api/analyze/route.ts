import Anthropic from "@anthropic-ai/sdk";
import { analyzeWithClaude, DEFAULT_MODEL, MAX_INPUT_CHARS, type ModelClient, type PayOverride } from "@/lib/ai";
import { US_STATES } from "@/lib/jurisdictions";

export const maxDuration = 60;

// Best-effort per-instance limiter. Serverless instances don't share memory,
// so put a real limiter (e.g. Vercel KV / Upstash) in front before heavy promotion.
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = Number(process.env.AI_CHECKS_PER_HOUR ?? 20);
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function bad(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return bad("AI checks aren't turned on for this site yet.", 503);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return bad("You've hit the hourly limit for AI checks. The free rules check still works.", 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid request.", 400);
  }
  const b = body as Record<string, unknown>;

  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (!text) return bad("Paste a posting first.", 400);
  if (text.length > MAX_INPUT_CHARS) return bad(`Postings are limited to ${MAX_INPUT_CHARS.toLocaleString()} characters.`, 413);

  const employees = typeof b.employees === "number" && b.employees > 0 ? Math.floor(b.employees) : null;
  const extraStates = Array.isArray(b.extraStates)
    ? b.extraStates.filter((s): s is string => typeof s === "string" && s in US_STATES)
    : [];
  const remoteAnywhereUS = typeof b.remoteAnywhereUS === "boolean" ? b.remoteAnywhereUS : undefined;

  let pay: PayOverride | undefined;
  const p = b.pay as Record<string, unknown> | undefined;
  if (p && typeof p.min === "number" && typeof p.max === "number" && p.min > 0 && p.max >= p.min && (p.period === "hour" || p.period === "year")) {
    pay = { min: p.min, max: p.max, period: p.period };
  }

  try {
    const client = new Anthropic() as unknown as ModelClient;
    const result = await analyzeWithClaude(client, { text, employees, extraStates, remoteAnywhereUS, pay }, process.env.ANTHROPIC_MODEL || DEFAULT_MODEL);
    return Response.json(result);
  } catch (err) {
    console.error("analyze failed", err);
    const msg = err instanceof Anthropic.APIError ? "The AI service is busy. Try again in a minute." : err instanceof Error ? err.message : "Something went wrong.";
    return bad(msg, 502);
  }
}
