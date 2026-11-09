import { afterEach, describe, expect, it, vi } from "vitest";
import {
  boardDateKey,
  collisions,
  daysUntil,
  expectedValueZar,
  fieldSize,
  formatMoney,
  severityOf,
  toZar,
  winProbability,
  zar,
} from "./analytics";
import type { Opportunity } from "./sonar-types";

/** A fully-populated Opportunity so each test states only what it cares about. */
function opp(over: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "x",
    name: "Test",
    organiser: "Org",
    kind: "hackathon",
    format: "online",
    scope: "local",
    tier: 2,
    score: 6,
    scores: { career_leverage: 6, winnability: 6, prize: 6, urgency: 6 },
    dates: {},
    next_date: null,
    confidence: "confirmed",
    prize: { currency: "ZAR", pool: 10_000 },
    career_track: "",
    eligibility: null,
    what_to_build: null,
    deliverables: null,
    links: {},
    notes: null,
    source: null,
    status: null,
    went_live_on: null,
    noticed_on: null,
    archived: false,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  } as Opportunity;
}

afterEach(() => vi.useRealTimers());

describe("boardDateKey", () => {
  it("reads the date on a Johannesburg wall clock, not UTC", () => {
    // 22:30 UTC on the 9th is already 00:30 on the 10th in SAST (UTC+2).
    expect(boardDateKey(new Date("2026-11-09T22:30:00Z"))).toBe("2026-11-10");
    expect(boardDateKey(new Date("2026-11-09T21:59:00Z"))).toBe("2026-11-09");
  });
});

describe("daysUntil", () => {
  const from = new Date("2026-11-09T10:00:00Z"); // 12:00 SAST on the 9th

  it("counts whole calendar days", () => {
    expect(daysUntil("2026-11-09", from)).toBe(0);
    expect(daysUntil("2026-11-10", from)).toBe(1);
    expect(daysUntil("2026-12-09", from)).toBe(30);
  });

  it("goes negative once the date has passed", () => {
    expect(daysUntil("2026-11-08", from)).toBe(-1);
  });

  it("does not depend on the host timezone near midnight", () => {
    // 22:30 UTC is 00:30 on the 10th in Johannesburg. A UTC "today" would
    // say the 10th is a day away; the board's calendar says it is today.
    const lateUtc = new Date("2026-11-09T22:30:00Z");
    expect(daysUntil("2026-11-10", lateUtc)).toBe(0);
    expect(daysUntil("2026-11-10", new Date("2026-11-09T21:59:00Z"))).toBe(1);
  });

  it("accepts a YYYY-MM-DD string as the reference date", () => {
    expect(daysUntil("2026-08-15", "2026-08-10")).toBe(5);
  });

  it("ignores a time suffix on the target date", () => {
    expect(daysUntil("2026-11-13T09:00:00+02:00", from)).toBe(4);
  });

  it("returns null, never NaN, for missing or unparseable input", () => {
    expect(daysUntil(null, from)).toBeNull();
    expect(daysUntil(undefined, from)).toBeNull();
    expect(daysUntil("", from)).toBeNull();
    expect(daysUntil("soon", from)).toBeNull();
    expect(daysUntil("2026-13-01", from)).toBeNull();
    expect(daysUntil("2026-02-31", from)).toBeNull(); // would roll into March
  });

  it("handles leap days", () => {
    expect(daysUntil("2028-03-01", "2028-02-28")).toBe(2);
    expect(daysUntil("2027-03-01", "2027-02-28")).toBe(1);
  });
});

describe("severityOf", () => {
  const at = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  };

  it("is critical at 7 days or fewer, warning to 21, stable beyond", () => {
    at("2026-11-09T10:00:00Z");
    expect(severityOf(opp({ next_date: "2026-11-16" }))).toBe("critical");
    expect(severityOf(opp({ next_date: "2026-11-17" }))).toBe("warning");
    expect(severityOf(opp({ next_date: "2026-11-30" }))).toBe("warning");
    expect(severityOf(opp({ next_date: "2026-12-01" }))).toBe("stable");
  });

  it("treats already-passed dates as critical", () => {
    at("2026-11-09T10:00:00Z");
    expect(severityOf(opp({ next_date: "2026-11-01" }))).toBe("critical");
  });

  it("does not colour-code dates that are not calendar-safe", () => {
    at("2026-11-09T10:00:00Z");
    expect(severityOf(opp({ next_date: "2026-11-10", confidence: "predicted" }))).toBe("none");
    expect(severityOf(opp({ next_date: "2026-11-10", confidence: "unconfirmed" }))).toBe("none");
    expect(severityOf(opp({ next_date: null }))).toBe("none");
  });

  it("returns none for an unparseable date instead of misreading it as stable", () => {
    at("2026-11-09T10:00:00Z");
    expect(severityOf(opp({ next_date: "TBA" }))).toBe("none");
  });
});

describe("collisions", () => {
  it("flags two committed entries in the same Monday-to-Sunday week", () => {
    const c = collisions([
      opp({ id: "a", name: "A", next_date: "2026-11-13" }), // Fri
      opp({ id: "b", name: "B", next_date: "2026-11-14" }), // Sat
    ]);
    expect(c).toHaveLength(1);
    expect(c[0]!.weekStart).toBe("2026-11-09");
    expect(c[0]!.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("puts Sunday and the following Monday in different weeks", () => {
    const c = collisions([
      opp({ id: "a", next_date: "2026-11-15" }), // Sun
      opp({ id: "b", next_date: "2026-11-16" }), // Mon
    ]);
    expect(c).toEqual([]);
  });

  it("labels the week by its Monday regardless of host timezone", () => {
    const c = collisions([
      opp({ id: "a", next_date: "2026-11-09" }),
      opp({ id: "b", next_date: "2026-11-11" }),
    ]);
    expect(c[0]!.weekStart).toBe("2026-11-09");
    expect(c[0]!.weekLabel).toMatch(/9/);
  });

  it("ignores predicted and unconfirmed entries", () => {
    const c = collisions([
      opp({ id: "a", next_date: "2026-11-10", confidence: "confirmed" }),
      opp({ id: "b", next_date: "2026-11-11", confidence: "predicted" }),
      opp({ id: "c", next_date: "2026-11-12", confidence: "unconfirmed" }),
    ]);
    expect(c).toEqual([]);
  });

  it("skips an unparseable date rather than throwing or inventing a week", () => {
    expect(() =>
      collisions([opp({ next_date: "TBA" }), opp({ id: "b", next_date: "2026-11-10" })]),
    ).not.toThrow();
  });

  it("orders weeks chronologically", () => {
    const c = collisions([
      opp({ id: "a", next_date: "2026-12-01" }),
      opp({ id: "b", next_date: "2026-12-02" }),
      opp({ id: "c", next_date: "2026-11-10" }),
      opp({ id: "d", next_date: "2026-11-11" }),
    ]);
    expect(c.map((x) => x.weekStart)).toEqual(["2026-11-09", "2026-11-30"]);
  });
});

describe("toZar / formatMoney / zar", () => {
  it("converts at the stated rates and rounds to whole rand", () => {
    expect(toZar(1000, "USD")).toBe(18_200);
    expect(toZar(100, "eur")).toBe(1966); // case-insensitive
    expect(toZar(5000, "ZAR")).toBe(5000);
  });

  it("treats a missing or unknown currency as rand, not dollars", () => {
    expect(toZar(5000)).toBe(5000);
    expect(toZar(5000, "XYZ")).toBe(5000);
  });

  it("is zero for no pool", () => {
    expect(toZar(undefined, "USD")).toBe(0);
    expect(toZar(0, "USD")).toBe(0);
  });

  it("formats money in the organiser's own currency", () => {
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney(100, "USD")).toBe("$100");
    expect(formatMoney(100)).toBe("R100");
  });

  it("abbreviates rand amounts", () => {
    expect(zar(950)).toBe("R950");
    expect(zar(12_500)).toBe("R12.5k");
    expect(zar(12_700_000)).toBe("R12.7m");
  });
});

describe("fieldSize", () => {
  it("reads a headcount from the notes", () => {
    expect(fieldSize(opp({ notes: "10,000+ students expected" }))).toBe(10_000);
    expect(fieldSize(opp({ eligibility: "1,540 participants so far" }))).toBe(1540);
    expect(fieldSize(opp({ notes: "50 teams" }))).toBe(50);
  });

  it("takes the biggest plausible figure", () => {
    expect(fieldSize(opp({ notes: "30 teams last year, 120 teams this year" }))).toBe(120);
  });

  it("returns null when no headcount is stated", () => {
    expect(fieldSize(opp())).toBeNull();
    expect(fieldSize(opp({ notes: "Closes 30 Oct 2026." }))).toBeNull();
  });

  it("does not glue a date or day count onto the headcount that follows it", () => {
    // Regression: the number pattern allowed spaces between digit groups, so
    // "15 16,000+ students" was read as 1,516,000 and crushed the win
    // probability of anything whose notes put a date before a headcount.
    expect(fieldSize(opp({ notes: "Event 17-18 Oct 2026, 16,000+ students registered" }))).toBe(
      16_000,
    );
    expect(fieldSize(opp({ notes: "Registered 15 16,000+ students" }))).toBe(16_000);
    expect(fieldSize(opp({ notes: "Round 2 50 teams advance" }))).toBe(50);
    expect(fieldSize(opp({ notes: "Opened in 2026 150 teams entered" }))).toBe(150);
  });

  it("still accepts a space as a thousands separator", () => {
    expect(fieldSize(opp({ notes: "16 000+ students" }))).toBe(16_000);
  });
});

describe("winProbability / expectedValueZar", () => {
  it("stays within 1-99", () => {
    const hi = opp({
      score: 10,
      scores: { career_leverage: 10, winnability: 100, prize: 10, urgency: 10 },
    });
    const lo = opp({
      score: 0,
      scores: { career_leverage: 0, winnability: 0, prize: 0, urgency: 0 },
    });
    expect(winProbability(hi)).toBeLessThanOrEqual(99);
    expect(winProbability(lo)).toBeGreaterThanOrEqual(1);
  });

  it("is lower for a confirmed huge field than for a small one", () => {
    const small = opp({ notes: "40 teams" });
    const huge = opp({ notes: "90,000 participants" });
    expect(winProbability(huge)).toBeLessThan(winProbability(small));
  });

  it("discounts unconfirmed dates", () => {
    expect(winProbability(opp({ confidence: "predicted" }))).toBeLessThan(
      winProbability(opp({ confidence: "confirmed" })),
    );
  });

  it("treats a global open call as more contested than a local one", () => {
    expect(winProbability(opp({ scope: "international" }))).toBeLessThan(
      winProbability(opp({ scope: "local" })),
    );
  });

  it("scales expected value with the pool and is zero with no prize", () => {
    const base = opp({ prize: { currency: "ZAR", pool: 10_000 } });
    const double = opp({ prize: { currency: "ZAR", pool: 20_000 } });
    expect(expectedValueZar(double)).toBeGreaterThan(expectedValueZar(base));
    expect(expectedValueZar(opp({ prize: { currency: "ZAR", pool: 0 } }))).toBe(0);
  });

  it("does not throw when scores or prize are missing", () => {
    expect(() =>
      winProbability({ ...opp(), scores: undefined, prize: undefined } as unknown as Opportunity),
    ).not.toThrow();
  });
});
