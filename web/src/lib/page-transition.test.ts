import { describe, expect, it } from "vitest";
import { SECTION_ORDER, sectionIndex, transitionType } from "./page-transition";

describe("sectionIndex", () => {
  it("follows the sidebar order", () => {
    expect(SECTION_ORDER.map((p) => sectionIndex(p))).toEqual([0, 1, 2, 3, 4]);
  });

  it("treats entry detail pages as deeper than every section", () => {
    expect(sectionIndex("/o/kiroween-2026")).toBe(SECTION_ORDER.length);
  });

  it("ignores a trailing slash", () => {
    expect(sectionIndex("/stats/")).toBe(1);
  });

  it("returns null for unknown paths", () => {
    expect(sectionIndex("/nope")).toBeNull();
    expect(sectionIndex("")).toBeNull();
  });
});

describe("transitionType", () => {
  it("goes forward to a later section and backward to an earlier one", () => {
    expect(transitionType("/", "/stats")).toBe("forward");
    expect(transitionType("/radar", "/")).toBe("backward");
    expect(transitionType("/stats", "/updates")).toBe("forward");
  });

  it("treats opening an entry as forward and returning as backward", () => {
    expect(transitionType("/", "/o/abc")).toBe("forward");
    expect(transitionType("/o/abc", "/")).toBe("backward");
  });

  it("fades when there is no sensible direction", () => {
    expect(transitionType(undefined, "/stats")).toBe("fade");
    expect(transitionType("/stats", "/stats")).toBe("fade");
    expect(transitionType("/o/a", "/o/b")).toBe("fade");
    expect(transitionType("/stats", "/missing")).toBe("fade");
  });
});
