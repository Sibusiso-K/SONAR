import { describe, expect, it } from "vitest";
import { formatPrizeBreakdown } from "./prize";

describe("formatPrizeBreakdown", () => {
  it("formats the schema's array of tiers", () => {
    expect(
      formatPrizeBreakdown(
        [
          { place: "Grand", amount: 8000, track: null },
          { place: "Finalist stipends: 10 x $250 GPU credits", amount: null, track: null },
        ],
        "USD",
      ),
    ).toBe("Grand: $8,000; Finalist stipends: 10 x $250 GPU credits");
  });

  it("never prints [object Object] for legacy object or string shapes", () => {
    const fromObject = formatPrizeBreakdown(
      { first_place: 5000, finalist_note: "stipends" },
      "USD",
    );
    expect(fromObject).toBe("First place: $5,000; Finalist note: stipends");
    expect(fromObject).not.toContain("[object Object]");
    expect(formatPrizeBreakdown("Not published.", "USD")).toBe("Not published.");
  });

  it("returns an empty string when there is nothing to show", () => {
    expect(formatPrizeBreakdown(undefined)).toBe("");
    expect(formatPrizeBreakdown(null)).toBe("");
    expect(formatPrizeBreakdown([])).toBe("");
    expect(formatPrizeBreakdown(42)).toBe("");
  });
});
