import { describe, expect, it } from "vitest";
import { formatNumber, kindLabel } from "./format";

describe("formatNumber", () => {
  it("groups thousands with commas and uses a point for decimals", () => {
    expect(formatNumber(1234567.8, 1)).toBe("1,234,567.8");
    expect(formatNumber(16000)).toBe("16,000");
  });

  it("keeps a fixed number of decimal places, including for zero", () => {
    // This is the exact value the server and browser disagreed on ("0,0" vs "0.0").
    expect(formatNumber(0, 1)).toBe("0.0");
    expect(formatNumber(3.85, 2)).toBe("3.85");
    expect(formatNumber(2, 2)).toBe("2.00");
  });

  it("rounds rather than truncating", () => {
    expect(formatNumber(2.678, 1)).toBe("2.7");
    expect(formatNumber(1499.5)).toBe("1,500");
  });

  it("handles negatives", () => {
    expect(formatNumber(-1234.5, 1)).toBe("-1,234.5");
  });

  it("uses no non-breaking or narrow spaces, which differ between runtimes", () => {
    expect(formatNumber(12_345_678)).not.toMatch(/[\u00A0\u202F ]/);
  });
});

describe("kindLabel", () => {
  it("turns identifiers into words", () => {
    expect(kindLabel("ml_competition")).toBe("ml competition");
    expect(kindLabel("startup_competition")).toBe("startup competition");
    expect(kindLabel("hackathon")).toBe("hackathon");
  });

  it("copes with a missing kind", () => {
    expect(kindLabel(null)).toBe("unknown");
    expect(kindLabel(undefined)).toBe("unknown");
  });
});
