import { describe, expect, it } from "vitest";
import { assistantSuggestions, sourceLabel } from "./assistant-ui";
import type { Opportunity } from "./sonar-types";

const NOW = new Date("2026-11-16T10:00:00+02:00");
const row = (over: Partial<Opportunity>) =>
  ({ id: "x", name: "X", score: 1, next_date: null, ...over }) as Opportunity;

describe("assistantSuggestions", () => {
  it("names the top-scored row and the nearest dated one", () => {
    const s = assistantSuggestions(
      [
        row({ name: "Mintek-SCi Grad Hackathon 2026", score: 82.5 }),
        row({ name: "Kiroween 2026 (Kiro Hackathon)", score: 59, next_date: "2026-12-04" }),
        row({ name: "Samsung Programme", score: 57, next_date: "2026-11-22" }),
        row({ name: "Already gone", score: 10, next_date: "2026-11-01" }),
      ],
      NOW,
    );
    expect(s).toEqual([
      "Which opportunity should we prioritise this week?",
      "Why is Mintek-SCi Grad Hackathon 2026 scored the way it is?",
      "Draft a submission checklist for Samsung Programme.",
      "What conflicts or risks do you see in the board right now?",
    ]);
  });

  it("names nothing when the board has not loaded", () => {
    expect(assistantSuggestions([], NOW)).toEqual([
      "Which opportunity should we prioritise this week?",
      "What conflicts or risks do you see in the board right now?",
    ]);
  });

  it("drops a trailing parenthetical and shortens a very long name", () => {
    const [, why] = assistantSuggestions(
      [row({ name: "Gates Foundation AI Fellow, Africa Regional Offices (12 months)", score: 9 })],
      NOW,
    );
    expect(why).toBe("Why is Gates Foundation AI Fellow, Africa Regional… scored the way it is?");
  });
});

describe("sourceLabel", () => {
  it("names the model and the service for a language-model answer", () => {
    expect(
      sourceLabel({
        provider: "openrouter",
        model: "nvidia/nemotron-3.5-lightning:free",
        skipped: [],
      }),
    ).toBe("nemotron-3.5-lightning · OpenRouter");
  });

  it("says the built-in engine answered, and why when a model was tried first", () => {
    expect(sourceLabel({ provider: "builtin", model: "sonar-core-1", skipped: [] })).toBe(
      "Built-in engine · read straight from the board",
    );
    expect(
      sourceLabel({
        provider: "builtin",
        model: "sonar-core-1",
        skipped: ["gemma-4-31b-it: rate limited"],
      }),
    ).toMatch(/rate limited just now$/);
    expect(
      sourceLabel({ provider: "builtin", model: "sonar-core-1", skipped: ["x: timed out"] }),
    ).toMatch(/did not answer$/);
  });

  it("does not blame the models when none was configured", () => {
    expect(
      sourceLabel({
        provider: "builtin",
        model: "sonar-core-1",
        skipped: ["OpenRouter: no key configured"],
      }),
    ).toBe("Built-in engine · read straight from the board");
  });
});
