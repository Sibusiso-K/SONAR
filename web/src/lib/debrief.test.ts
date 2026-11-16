import { describe, expect, it } from "vitest";
import {
  awaitingDebrief,
  daysSinceLastMilestone,
  dismiss,
  dismissedIds,
  keepLocally,
  localDebriefs,
  parseModelFields,
  structureBuiltin,
  verifyAgainstText,
  type Debrief,
} from "./debrief";
import type { Opportunity } from "./sonar-types";

const NOW = new Date("2026-11-16T10:00:00+02:00");
const row = (over: Partial<Opportunity>) =>
  ({
    id: "x",
    name: "X",
    next_date: null,
    confidence: "confirmed",
    status: "open",
    dates: {},
    ...over,
  }) as Opportunity;

function memory(): Pick<Storage, "getItem" | "setItem"> {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("awaitingDebrief", () => {
  const paypal = row({ id: "paypal", dates: { submission_deadline: "2026-11-12T22:00:00+02:00" } });

  it("asks about a row whose dates have all passed", () => {
    expect(awaitingDebrief([paypal], NOW, new Set())).toEqual([{ o: paypal, daysAgo: 4 }]);
  });

  it("puts the most recently finished first", () => {
    const older = row({ id: "older", dates: { event_end: "2026-10-20" } });
    expect(awaitingDebrief([older, paypal], NOW, new Set()).map((x) => x.o.id)).toEqual([
      "paypal",
      "older",
    ]);
  });

  it("does not ask about something still ahead, already handled, or marked finished", () => {
    const ahead = row({ id: "a", dates: { submission_deadline: "2026-12-04" } });
    const partly = row({ id: "b", dates: { start: "2026-10-01", judging: "2026-12-01" } });
    const dropped = row({ id: "c", status: "dropped", dates: { event_end: "2026-11-10" } });
    expect(awaitingDebrief([ahead, partly, dropped], NOW, new Set())).toEqual([]);
    expect(awaitingDebrief([paypal], NOW, new Set(["paypal"]))).toEqual([]);
  });

  it("does not ask on the strength of an unconfirmed date or last year's", () => {
    const shaky = row({ id: "s", confidence: "unconfirmed", dates: { event_end: "2026-11-10" } });
    const history = row({
      id: "h",
      dates: { prior_year_event: "2025-10-24", checked_on: "2026-10-04" },
    });
    expect(awaitingDebrief([shaky, history], NOW, new Set())).toEqual([]);
  });

  it("stops asking once the moment has gone", () => {
    const stale = row({ id: "old", dates: { event_end: "2026-08-01" } });
    expect(awaitingDebrief([stale], NOW, new Set())).toEqual([]);
    expect(daysSinceLastMilestone(stale, NOW)).toBe(107);
  });
});

describe("structureBuiltin", () => {
  const text =
    "We submitted with an hour to spare and placed 3rd. Spent about 30 hours between us. " +
    "The agent orchestration worked really well. The auth flow broke twice and cost us Saturday morning. " +
    'Next time we reuse the MCP server template. The judges said "clearest demo of the day, but the pricing slide was thin".';

  it("lifts each field from the text", () => {
    const f = structureBuiltin(text);
    expect(f.placement).toBe("3rd");
    expect(f.hours_spent).toBe(30);
    expect(f.what_worked).toContain("agent orchestration worked");
    expect(f.what_cost_us).toContain("auth flow broke");
    expect(f.would_reuse).toEqual(["Next time we reuse the MCP server template."]);
    expect(f.judge_feedback).toBe("clearest demo of the day, but the pricing slide was thin");
  });

  it("leaves everything empty when the text says nothing sortable", () => {
    expect(structureBuiltin("We went.")).toEqual({
      placement: null,
      hours_spent: null,
      what_worked: null,
      what_cost_us: null,
      would_reuse: [],
      judge_feedback: null,
    });
  });

  it("produces only values that pass its own verification", () => {
    const f = structureBuiltin(text);
    expect(verifyAgainstText(f, text)).toEqual(f);
  });
});

describe("verifyAgainstText", () => {
  const text = 'We built a triage bot in 20 hours. The demo worked. The judges said "solid" to us.';
  const base = {
    placement: null,
    hours_spent: null,
    what_worked: null,
    what_cost_us: null,
    would_reuse: [],
    judge_feedback: null,
  };

  it("drops a placement, hours figure or judge quote the person never wrote", () => {
    const out = verifyAgainstText(
      {
        ...base,
        placement: "2nd place",
        hours_spent: 45,
        judge_feedback: "Outstanding technical depth",
      },
      text,
    );
    expect(out).toMatchObject({ placement: null, hours_spent: null, judge_feedback: null });
  });

  it("keeps values that are in the text", () => {
    const out = verifyAgainstText({ ...base, hours_spent: 20, judge_feedback: "solid" }, text);
    expect(out).toMatchObject({ hours_spent: 20, judge_feedback: "solid" });
  });

  it("does not accept 20 for a text that says 120", () => {
    expect(
      verifyAgainstText({ ...base, hours_spent: 20 }, "It took 120 hours.").hours_spent,
    ).toBeNull();
  });

  it("keeps tidied prose but drops prose the model wrote itself", () => {
    const out = verifyAgainstText(
      {
        ...base,
        what_worked: "The demo worked.",
        what_cost_us: "Poor stakeholder alignment undermined velocity throughout",
        would_reuse: ["triage bot", "a robust microservices architecture"],
      },
      text,
    );
    expect(out.what_worked).toBe("The demo worked.");
    expect(out.what_cost_us).toBeNull();
    expect(out.would_reuse).toEqual(["triage bot"]);
  });
});

describe("parseModelFields", () => {
  it("reads JSON wrapped in prose or a code fence", () => {
    const f = parseModelFields(
      'Here you go:\n```json\n{"placement":"Top 6","hours_spent":"12","would_reuse":["x",3]}\n```',
    );
    expect(f).toMatchObject({ placement: "Top 6", hours_spent: 12, would_reuse: ["x"] });
  });

  it("returns null for anything that is not an object", () => {
    expect(parseModelFields("I could not parse that.")).toBeNull();
    expect(parseModelFields("{not json}")).toBeNull();
  });
});

describe("device memory", () => {
  it("honours a snooze until it expires, per person", () => {
    const s = memory();
    dismiss(s, "Sibusiso", "paypal", new Date(NOW.getTime() + 86_400_000));
    expect(dismissedIds(s, "Sibusiso", NOW).has("paypal")).toBe(true);
    expect(dismissedIds(s, "Lethabo", NOW).has("paypal")).toBe(false);
    expect(dismissedIds(s, "Sibusiso", new Date(NOW.getTime() + 2 * 86_400_000)).size).toBe(0);
  });

  it("keeps debriefs locally and ignores corrupt or foreign entries", () => {
    const s = memory();
    const d = { id: "1", filed_by: "Lethabo", opportunity_id: "p" } as Debrief;
    keepLocally(s, d);
    expect(localDebriefs(s)).toEqual([d]);
    s.setItem("sonar.debrief.local", JSON.stringify([{ id: "2", filed_by: "Mallory" }]));
    expect(localDebriefs(s)).toEqual([]);
    s.setItem("sonar.debrief.local", "{broken");
    expect(localDebriefs(s)).toEqual([]);
  });

  it("survives storage that throws", () => {
    const hostile = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => dismiss(hostile, "Sibusiso", "x", NOW)).not.toThrow();
    expect(dismissedIds(hostile, "Sibusiso", NOW).size).toBe(0);
    expect(localDebriefs(hostile)).toEqual([]);
  });
});
