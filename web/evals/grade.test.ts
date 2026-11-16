import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { answerBuiltin } from "../src/lib/assistant.builtin";
import type { BoardSnapshot } from "../src/lib/assistant.context";
import { CASES, FROZEN_NOW } from "./cases";
import { datesIn, grade } from "./grade";

describe("datesIn", () => {
  it("reads the three ways a date gets written", () => {
    expect([...datesIn("due 2026-12-04")]).toEqual(["12-04"]);
    expect([...datesIn("due 4 Dec 2026")]).toEqual(["12-04"]);
    expect([...datesIn("due on the 4th of December")]).toEqual(["12-04"]);
    expect([...datesIn("due December 4th, 2026")]).toEqual(["12-04"]);
    expect([...datesIn("due Sept. 7")]).toEqual(["09-07"]);
  });

  it("does not read a time or a year as a day", () => {
    expect([...datesIn("Thu 12 Nov 22:00 SAST")]).toEqual(["11-12"]);
    expect([...datesIn("some time in Dec 2026")]).toEqual([]);
    expect([...datesIn("late October 2026")]).toEqual([]);
  });

  it("ignores impossible dates", () => {
    expect([...datesIn("2026-13-40 and 45 Dec")]).toEqual([]);
  });
});

describe("grade", () => {
  const board = "Kiroween next_date 2026-12-04";
  const c = { id: "x", skill: "x", question: "?", must: ["kiroween"], mustNot: ["\\$\\d"] };

  it("passes an answer that has the fact and nothing invented", () => {
    expect(grade("Kiroween closes on 4 Dec.", c, board).pass).toBe(true);
  });

  it("fails on a missing fact", () => {
    expect(grade("It closes on 4 Dec.", c, board).missing).toEqual(["kiroween"]);
  });

  it("fails on a forbidden claim", () => {
    expect(grade("Kiroween pays $5000.", c, board).violations).toHaveLength(1);
  });

  it("fails on a date the board does not contain, even when the facts are right", () => {
    const g = grade("Kiroween closes on 9 December.", c, board);
    expect(g.pass).toBe(false);
    expect(g.ungroundedDates).toEqual(["12-09"]);
  });

  it("enforces a length cap", () => {
    expect(grade("Kiroween ".repeat(20), { ...c, maxChars: 50 }, board).tooLong).toBe(true);
  });
});

describe("built-in engine on the frozen board", () => {
  const raw = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "board.snapshot.json"), "utf-8"),
  );
  const snapshot: BoardSnapshot = {
    live: raw.live,
    past: raw.past,
    updates: raw.updates,
    now: FROZEN_NOW,
  };
  const corpus = JSON.stringify(raw);

  // The built-in engine is deterministic, so this is a regression test: a
  // change that breaks one of these answers breaks the assistant's floor.
  it.each(CASES)("answers $id", (c) => {
    const reply = answerBuiltin([{ role: "user", content: c.question }], snapshot).reply;
    const g = grade(reply, c, corpus);
    expect(g, reply).toMatchObject({ pass: true });
  });
});
