import { describe, expect, it } from "vitest";
import { analyzeWithClaude, countPlaceholders, toParsed, type Extraction, type ModelClient } from "../ai";

const baseExtraction: Extraction = {
  job_title: "Designer",
  pay: { found: false, raw_text: null, min: null, max: null, period: "unknown", open_ended: false },
  vague_pay_phrases: ["competitive salary"],
  work_locations: [{ state_code: "CO", city: "Denver" }],
  remote: "not_remote",
  remote_states: [],
  benefits_described: false,
  application_deadline: null,
};

function fakeClient(responses: object[]): ModelClient & { calls: { system: string; content: string }[] } {
  const calls: { system: string; content: string }[] = [];
  return {
    calls,
    messages: {
      async create(body) {
        calls.push({ system: body.system, content: body.messages[0].content });
        const next = responses.shift();
        return { content: [{ type: "text", text: JSON.stringify(next) }], stop_reason: "end_turn" };
      },
    },
  };
}

describe("toParsed", () => {
  it("maps cities to local jurisdictions only when the state matches", () => {
    const p = toParsed({
      ...baseExtraction,
      work_locations: [{ state_code: "NY", city: "Brooklyn" }, { state_code: "GA", city: "Columbus" }],
    });
    expect(p.states).toEqual(["GA", "NY"]);
    expect(p.locals).toEqual(["NYC"]);
  });
  it("adds remote-limited states and maps remote scope", () => {
    const p = toParsed({ ...baseExtraction, work_locations: [], remote: "limited_states", remote_states: ["wa", "XX"] });
    expect(p.states).toEqual(["WA"]);
    expect(p.remote).toBe("none");
    expect(toParsed({ ...baseExtraction, remote: "anywhere_in_us" }).remote).toBe("us-wide");
  });
  it("carries pay through", () => {
    const p = toParsed({ ...baseExtraction, pay: { found: true, raw_text: "$80-120k", min: 80000, max: 120000, period: "year", open_ended: false } });
    expect(p.pay).toMatchObject({ min: 80000, max: 120000, period: "year", openEnded: false });
  });
});

describe("analyzeWithClaude", () => {
  it("judges with the rules engine and re-verifies the rewrite", async () => {
    const client = fakeClient([
      baseExtraction,
      {
        rewritten_posting:
          "Product Designer, Denver, CO.\nPay: $95,000 – $120,000 per year.\nBenefits: medical, dental, 401(k) and PTO.\n[Applications close: DATE]",
        changes: [{ what: "Added pay range", why: "Colorado requires a range" }],
      },
    ]);
    const r = await analyzeWithClaude(client, { text: "Product Designer, Denver. Competitive salary.", employees: 40, pay: { min: 95000, max: 120000, period: "year" } });

    // Original fails in Colorado on all three elements.
    const co = r.report.results.find((x) => x.jurisdiction.id === "CO")!;
    expect(co.checks.filter((c) => c.status === "fail").map((c) => c.id)).toEqual(["range", "benefits", "close"]);

    // The rewrite prompt carries the findings and the employer's pay.
    expect(client.calls[1].content).toContain("Colorado: Pay range in posting");
    expect(client.calls[1].content).toContain("$95,000 – $120,000 per year");
    expect(client.calls[1].content).toContain("<posting>");

    // Rewrite: range and benefits now pass; the deadline is a placeholder, so it still fails until filled.
    const co2 = r.rewriteReport.results.find((x) => x.jurisdiction.id === "CO")!;
    const byId = Object.fromEntries(co2.checks.map((c) => [c.id, c.status]));
    expect(byId).toEqual({ range: "pass", benefits: "pass", close: "fail" });
    expect(r.placeholders).toEqual(["[Applications close: DATE]"]);
  });

  it("does not let a benefits placeholder count as a benefits description", async () => {
    const client = fakeClient([
      baseExtraction,
      { rewritten_posting: "Designer, Denver, CO. $90,000 – $110,000 per year. [Benefits: describe health and retirement]", changes: [] },
    ]);
    const r = await analyzeWithClaude(client, { text: "Designer, Denver.", employees: 10 });
    const co2 = r.rewriteReport.results.find((x) => x.jurisdiction.id === "CO")!;
    expect(co2.checks.find((c) => c.id === "benefits")!.status).toBe("fail");
  });

  it("surfaces refusals as errors", async () => {
    const client: ModelClient = { messages: { create: async () => ({ content: [], stop_reason: "refusal" }) } };
    await expect(analyzeWithClaude(client, { text: "x", employees: null })).rejects.toThrow(/declined/);
  });
});

describe("countPlaceholders", () => {
  it("finds bracketed placeholders", () => {
    expect(countPlaceholders("Pay [Pay range: $MIN – $MAX] and [Benefits: list]")).toHaveLength(2);
  });
});
