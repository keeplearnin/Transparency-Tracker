import { describe, expect, it } from "vitest";
import { evaluate } from "../evaluate";
import { extractPay, detectLocations, detectRemote, detectCloseDate } from "../parse";

const TODAY = new Date("2026-10-18");

describe("extractPay", () => {
  it("reads a dollar range with k suffix", () => {
    expect(extractPay("Salary: $80k - $120k per year")).toMatchObject({ min: 80000, max: 120000, period: "year" });
  });
  it("applies a trailing k to both sides", () => {
    expect(extractPay("Pay range $80-120k")).toMatchObject({ min: 80000, max: 120000 });
  });
  it("reads comma ranges with 'to'", () => {
    expect(extractPay("The base salary is $95,000 to $125,000 annually.")).toMatchObject({ min: 95000, max: 125000, period: "year" });
  });
  it("reads hourly ranges", () => {
    expect(extractPay("$22.50 - $28/hr")).toMatchObject({ min: 22.5, max: 28, period: "hour" });
  });
  it("flags open-ended pay", () => {
    expect(extractPay("Up to $150,000 depending on experience")).toMatchObject({ openEnded: true, max: null });
    expect(extractPay("$90k+")).toMatchObject({ openEnded: true });
  });
  it("ignores funding amounts", () => {
    expect(extractPay("We raised $20 million in funding last year.")).toBeNull();
  });
});

describe("location and remote detection", () => {
  it("finds City, ST patterns and NYC", () => {
    const r = detectLocations("Location: New York, NY (hybrid). Also Denver, CO.");
    expect(r.states).toEqual(["CO", "NY"]);
    expect(r.locals).toContain("NYC");
  });
  it("does not treat Washington, DC as Washington State", () => {
    expect(detectLocations("Based in Washington, DC").states).toEqual(["DC"]);
  });
  it("does not match bare two-letter words", () => {
    expect(detectLocations("Join us or me in building this.").states).toEqual([]);
  });
  it("drops Columbus when Ohio isn't mentioned", () => {
    expect(detectLocations("Columbus, GA office").locals).toEqual([]);
  });
  it("detects remote scope", () => {
    expect(detectRemote("This role is Remote (US)")).toBe("us-wide");
    expect(detectRemote("Hybrid, 3 days in office")).toBe("remote");
    expect(detectRemote("On-site in Austin")).toBe("none");
  });
  it("finds an application deadline", () => {
    expect(detectCloseDate("Applications close on November 15, 2026.")).toBe("November 15, 2026");
  });
});

describe("evaluate", () => {
  it("fails a Colorado posting with no range, benefits or deadline", () => {
    const r = evaluate({ text: "Software Engineer in Denver, CO. Competitive salary.", employees: 50, today: TODAY });
    const co = r.results.find((x) => x.jurisdiction.id === "CO")!;
    expect(co.status).toBe("fail");
    expect(co.checks.map((c) => [c.id, c.status])).toEqual([
      ["range", "fail"], ["benefits", "fail"], ["close", "fail"],
    ]);
  });

  it("passes a complete Colorado posting", () => {
    const text = `Software Engineer, Denver, CO. Salary $110,000 - $140,000 per year.
      Benefits include medical, dental, 401(k) match and PTO. Applications close November 30, 2026.`;
    const r = evaluate({ text, employees: 50, today: TODAY });
    expect(r.results.find((x) => x.jurisdiction.id === "CO")!.status).toBe("pass");
  });

  it("treats a remote US role as covered by every posting state", () => {
    const r = evaluate({ text: "Fully remote (US). $100k-$130k. Medical, dental and 401k.", employees: 500, today: TODAY });
    const ids = r.results.filter((x) => x.applicability === "in-force").map((x) => x.jurisdiction.id);
    expect(ids).toEqual(expect.arrayContaining(["CA", "CO", "NY", "WA", "IL", "VA", "CT", "MA"]));
    // Delaware is not in force until 2027.
    expect(r.results.find((x) => x.jurisdiction.id === "DE")!.applicability).toBe("upcoming");
  });

  it("respects employee thresholds", () => {
    const r = evaluate({ text: "Analyst in Honolulu, Hawaii. Competitive pay.", employees: 20, today: TODAY });
    expect(r.results.find((x) => x.jurisdiction.id === "HI")!.applicability).toBe("below-threshold");
  });

  it("warns on very wide ranges", () => {
    const r = evaluate({ text: "Seattle, WA. $60,000 - $250,000. Benefits included.", employees: 100, today: TODAY });
    expect(r.general.find((c) => c.id === "width")!.status).toBe("warn");
  });

  it("accepts a single figure in New Jersey", () => {
    const r = evaluate({ text: "Newark, NJ warehouse associate, $21/hour. Health benefits and PTO.", employees: 40, today: TODAY });
    expect(r.results.find((x) => x.jurisdiction.id === "NJ")!.status).toBe("pass");
  });

  it("flags exclusionary language", () => {
    const r = evaluate({ text: "Looking for a young rockstar salesman. Austin, TX.", employees: 10, today: TODAY });
    expect(r.language.map((f) => f.category)).toEqual(expect.arrayContaining(["age", "jargon", "gendered"]));
  });

  it("warns when no location can be determined", () => {
    const r = evaluate({ text: "Marketing manager. $80k-$95k.", employees: 30, today: TODAY });
    expect(r.general.find((c) => c.id === "location")?.status).toBe("warn");
  });
});
