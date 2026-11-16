import { describe, expect, it } from "vitest";
import { arcPoints, deadlineField, greeting, totals, upcoming, urgency } from "./board-view";
import type { Opportunity, PastOpportunity } from "./sonar-types";

const NOW = new Date("2026-11-16T10:00:00+02:00");
const row = (over: Partial<Opportunity>) =>
  ({
    id: "x",
    name: "X",
    kind: "hackathon",
    tier: 3,
    score: 50,
    next_date: null,
    confidence: "confirmed",
    prize: {},
    ...over,
  }) as Opportunity;

const live = [
  row({ id: "samsung", kind: "programme", next_date: "2026-11-22", confidence: "reported" }),
  row({ id: "kiro", next_date: "2026-12-04", score: 100, prize: { pool: 100, currency: "ZAR" } }),
  row({ id: "far", next_date: "2027-06-01" }),
  row({ id: "gone", next_date: "2026-11-01" }),
  row({ id: "undated", tier: 1, confidence: "unconfirmed" }),
];

describe("upcoming", () => {
  it("lists future dates nearest first and leaves out past and undated rows", () => {
    expect(upcoming(live, NOW).map((d) => [d.o.id, d.days])).toEqual([
      ["samsung", 6],
      ["kiro", 18],
      ["far", 197],
    ]);
  });
});

describe("urgency", () => {
  it("uses the board's week and three-week thresholds", () => {
    expect([0, 7, 8, 21, 22].map(urgency)).toEqual([
      "critical",
      "critical",
      "warning",
      "warning",
      "later",
    ]);
  });
});

describe("deadlineField", () => {
  const f = deadlineField(live, NOW);

  it("orders rows by how many entries each kind has", () => {
    expect(f.rows.map((r) => r.kind)).toEqual(["hackathon", "programme"]);
  });

  it("counts rows with no upcoming date instead of hiding them", () => {
    // "gone" has a date, but it has passed; "undated" never had one.
    expect(f.rows[0]).toMatchObject({ undated: 1 });
  });

  it("places bubbles by days and sizes them by score", () => {
    const kiro = f.bubbles.find((b) => b.o.id === "kiro")!;
    expect(kiro).toMatchObject({ row: 0, size: 40, urgency: "warning" });
    expect(kiro.x).toBeCloseTo(18 / 112);
  });

  it("reports dates beyond the window rather than dropping them silently", () => {
    expect(f).toMatchObject({ dated: 3, beyond: 1 });
  });
});

describe("totals", () => {
  it("adds up what the header strip shows", () => {
    const past = [
      { outcome: "placed", placement: "3rd place" },
      { outcome: "entered", placement: "Did not place" },
    ] as PastOpportunity[];
    expect(totals(live, past)).toMatchObject({
      live: 5,
      tiers: [1, 0, 4],
      poolZar: 100,
      confirmed: 3,
      reported: 1,
      shaky: 1,
      entered: 2,
      placed: 1,
      best: "3rd place",
    });
  });
});

describe("arcPoints", () => {
  it("spreads points left to right over a half circle", () => {
    const pts = arcPoints(3, 10);
    expect(pts[0]!.x).toBeCloseTo(-10);
    expect(pts[1]!.y).toBeCloseTo(-10);
    expect(pts[2]!.x).toBeCloseTo(10);
    expect(arcPoints(0, 10)).toEqual([]);
  });
});

describe("greeting", () => {
  it("follows the Johannesburg clock, not the server's", () => {
    expect(greeting(new Date("2026-11-16T05:00:00Z"))).toBe("Good morning");
    expect(greeting(new Date("2026-11-16T11:00:00Z"))).toBe("Good afternoon");
    expect(greeting(new Date("2026-11-16T17:00:00Z"))).toBe("Good evening");
  });
});
