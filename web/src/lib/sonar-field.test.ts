import { describe, expect, it } from "vitest";
import { fieldStep, MAX_RIPPLES, type Ripple } from "./sonar-field";

const ripple = (born: number, life = 1000): Ripple => ({
  x: 0,
  y: 0,
  born,
  speed: 0.2,
  life,
  strength: 1,
});

describe("fieldStep", () => {
  it("drops rings that have fully faded", () => {
    expect(fieldStep([ripple(0), ripple(600)], 1200)).toEqual([ripple(600)]);
  });

  it("keeps only the newest rings when the pointer makes too many", () => {
    const many = Array.from({ length: MAX_RIPPLES + 6 }, (_, i) => ripple(i));
    const kept = fieldStep(many, 50);
    expect(kept).toHaveLength(MAX_RIPPLES);
    expect(kept[0]!.born).toBe(6);
  });

  it("returns nothing for an empty field", () => {
    expect(fieldStep([], 0)).toEqual([]);
  });
});
