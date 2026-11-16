import { describe, expect, it } from "vitest";
import {
  answerBuiltin,
  findMentioned,
  formatDay,
  properTokens,
  rankForAction,
} from "./assistant.builtin";
import { buildCompactPrompt, buildSystemPrompt, type BoardSnapshot } from "./assistant.context";
import type { Opportunity, PastOpportunity } from "./sonar-types";

const NOW = new Date("2026-11-16T10:00:00+02:00");

function opp(over: Partial<Opportunity> & { id: string; name: string }): Opportunity {
  return {
    organiser: "Organiser",
    kind: "hackathon",
    format: "online",
    scope: "international",
    tier: 3,
    score: 50,
    scores: { career_leverage: 50, winnability: 50, prize: 50, urgency: 50 },
    dates: {},
    next_date: null,
    confidence: "confirmed",
    prize: {},
    career_track: "indirect",
    eligibility: null,
    what_to_build: null,
    deliverables: null,
    links: {},
    notes: null,
    source: null,
    status: "open",
    went_live_on: null,
    noticed_on: null,
    archived: false,
    created_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

const samsung = opp({
  id: "samsung-dev-programme",
  name: "Samsung Software Development Programme",
  organiser: "Tshimologong",
  kind: "programme",
  next_date: "2026-11-22",
  confidence: "reported",
  score: 57.5,
});
const kiro = opp({
  id: "kiroween-2026",
  name: "Kiroween 2026 (Kiro Hackathon)",
  organiser: "AWS",
  next_date: "2026-12-04",
  dates: { submission_deadline: "2026-12-04T14:00:00-08:00", confidence: "reported" },
  confidence: "reported",
  score: 59,
  prize: {
    currency: "USD",
    pool: 100000,
    breakdown: [{ place: "1st", amount: 30000, track: null }],
  },
  deliverables: "Devpost submission\nProject repository",
  eligibility: "Legal age where you live. Teams of up to 3.",
  links: { main: "https://example.com/kiro" },
});
const fnb = opp({
  id: "fnb-aoty-2026",
  name: "FNB App of the Year Hackathon 2026",
  organiser: "FNB",
  confidence: "unconfirmed",
  score: 66,
  dates: { expected_window: "Late October 2026", prior_year_event: "2025-10-24" },
});
const mintek = opp({
  id: "mintek-sci-2026",
  name: "Mintek-SCi Grad Hackathon 2026",
  organiser: "Mintek",
  tier: 1,
  score: 82.5,
  scores: { career_leverage: 90, winnability: 90, prize: 60, urgency: 80 },
  status: "selected",
  prize: { currency: "ZAR", pool: 50000 },
});
const imagine = opp({
  id: "imagine-cup-2027",
  name: "Microsoft Imagine Cup 2027",
  organiser: "Microsoft",
  next_date: "2027-02-28",
});
const submitted = opp({
  id: "sme-toolkit-2026",
  name: "SME Toolkit Business Plan Competition",
  organiser: "BizCommunity",
  next_date: "2026-11-30",
  status: "submitted",
  score: 90,
});
const lapsed = opp({
  id: "paypal-ai-hackathon-2026",
  name: "PayPal AI Hackathon",
  organiser: "PayPal",
  dates: { submission_deadline: "2026-11-12T22:00:00+02:00" },
  prize: { currency: "USD", pool: 67500 },
});

const ibm: PastOpportunity = {
  id: "ibm-dev-day",
  name: "IBM Dev Day: Bob in Action + Hackathon",
  organiser: "IBM",
  kind: "hackathon",
  happened_on: "2026-08-30",
  outcome: "placed",
  placement: "3rd place",
  note: null,
  corrected: false,
  correction_note: null,
};

const snap: BoardSnapshot = {
  live: [samsung, kiro, fnb, mintek, imagine, submitted, lapsed],
  past: [ibm],
  updates: [],
  now: NOW,
};

const ask = (q: string, s: BoardSnapshot = snap) =>
  answerBuiltin([{ role: "user", content: q }], s);

describe("answerBuiltin", () => {
  it("lists the nearest dates, nearest first", () => {
    const a = ask("What closes soonest?");
    expect(a.intent).toBe("soonest");
    expect(a.reply.indexOf("Samsung")).toBeLessThan(a.reply.indexOf("Kiroween"));
    expect(a.reply).toContain("22 Nov 2026, in 6 days");
  });

  it("limits to a window when asked for this week", () => {
    const a = ask("Is anything due this week?");
    expect(a.reply).toContain("Samsung");
    expect(a.reply).not.toContain("Kiroween");
  });

  it("says so when nothing falls in the window, and names the next date", () => {
    const later: BoardSnapshot = { ...snap, live: [kiro, imagine] };
    const a = ask("Anything due this week?", later);
    expect(a.reply).toMatch(/Nothing on the board falls due in the next 7 days/);
    expect(a.reply).toContain("Kiroween");
  });

  it("counts days to a named deadline", () => {
    const a = ask("How many days until the Kiroween submission deadline?");
    expect(a.intent).toBe("dates");
    expect(a.reply).toContain("in 18 days");
  });

  it("flags an unconfirmed row and does not turn a vague window into a date", () => {
    const a = ask("When is the FNB App of the Year hackathon?");
    expect(a.reply).toMatch(/unconfirmed: not calendar-safe/);
    expect(a.reply).toMatch(/no upcoming date on record/);
    expect(a.reply).not.toMatch(/October 2026/);
  });

  it("explains a score from its recorded inputs", () => {
    const a = ask("Why does Mintek score so high?");
    expect(a.intent).toBe("explain-score");
    expect(a.reply).toContain("82.5");
    expect(a.reply).toContain("career leverage: 90");
    expect(a.reply).toMatch(/not forecasts/);
  });

  it("quotes a prize in its own currency with a rand equivalent", () => {
    const a = ask("What does Kiroween pay?");
    expect(a.intent).toBe("prize");
    expect(a.reply).toContain("$100,000");
    expect(a.reply).toContain("1st: $30,000");
  });

  it("ranks the largest pools when no row is named", () => {
    const a = ask("What is the biggest prize on the board?");
    expect(a.reply.indexOf("Kiroween")).toBeLessThan(a.reply.indexOf("Mintek"));
  });

  it("builds a checklist only from what the row records", () => {
    const a = ask("Draft a submission checklist for Kiroween");
    expect(a.intent).toBe("checklist");
    expect(a.reply).toContain("- [ ] Devpost submission");
    expect(a.reply).toContain("- [ ] Project repository");
    expect(a.reply).toContain("submission deadline: 4 Dec 2026");
    expect(a.reply).toContain("https://example.com/kiro");
  });

  it("says a checklist has no deliverables rather than inventing them", () => {
    const a = ask("Checklist for the Samsung programme");
    expect(a.reply).toMatch(/none recorded/);
  });

  it("reports missing eligibility as missing", () => {
    const a = ask("Are we eligible for the Samsung programme?");
    expect(a.intent).toBe("eligibility");
    expect(a.reply).toMatch(/no eligibility rule recorded/);
  });

  it("reads results from the archive, even when a live row shares a word", () => {
    const a = ask("How did we do at the IBM Dev Day hackathon?");
    expect(a.intent).toBe("past");
    expect(a.reply).toContain("3rd place");
  });

  it("refuses to answer about an event the board does not have", () => {
    const a = ask("What is the prize for the Standard Bank Fintech Cup?");
    expect(a.intent).toBe("not-found");
    expect(a.reply).not.toMatch(/[R$]\s?\d/);
    expect(a.reply).not.toContain("Imagine");
  });

  it("declines requests that have nothing to do with the board", () => {
    const a = ask("Write me a poem about the ocean.");
    expect(a.intent).toBe("out-of-scope");
  });

  it("surfaces risks: shaky dates, undated rows and rows whose dates have all passed", () => {
    const a = ask("What risks do you see on the board?");
    expect(a.intent).toBe("risks");
    expect(a.reply).toContain("FNB App of the Year Hackathon 2026: unconfirmed");
    expect(a.reply).toMatch(/Every dated milestone has passed[^\n]*\n- PayPal AI Hackathon/);
  });

  it("resolves a follow-up to the row the conversation was about", () => {
    const a = answerBuiltin(
      [
        { role: "user", content: "Tell me about Kiroween" },
        { role: "assistant", content: "..." },
        { role: "user", content: "What is its prize?" },
      ],
      snap,
    );
    expect(a.intent).toBe("prize");
    expect(a.reply).toContain("$100,000");
  });

  it("does not drag an old subject into a fresh board question", () => {
    const a = answerBuiltin(
      [
        { role: "user", content: "Tell me about Kiroween" },
        { role: "assistant", content: "..." },
        { role: "user", content: "What closes soonest?" },
      ],
      snap,
    );
    expect(a.intent).toBe("soonest");
  });

  it("asks which row when a name fits more than one", () => {
    const twins: BoardSnapshot = {
      ...snap,
      live: [
        opp({ id: "zindi-a", name: "Zindi Road Challenge", organiser: "Zindi" }),
        opp({ id: "zindi-b", name: "Zindi Bias Bounty", organiser: "Zindi" }),
      ],
    };
    expect(ask("When is the zindi one due?", twins).intent).toBe("ambiguous");
  });

  it("will not report season totals from an archive it could not read", () => {
    const a = ask("How is the season going so far?", { ...snap, pastUnavailable: true });
    expect(a.reply).toMatch(/could not be read/);
  });

  it("handles an empty board and an empty question", () => {
    const empty: BoardSnapshot = { live: [], past: [], updates: [], now: NOW };
    expect(ask("What closes soonest?", empty).reply).toMatch(/No live row has an upcoming date/);
    expect(ask("   ").intent).toBe("help");
    expect(ask("hello").intent).toBe("help");
  });

  it("never prints a date that is not on the board", () => {
    const corpus = JSON.stringify(snap);
    const questions = [
      "What closes soonest?",
      "What should we prioritise this week?",
      "What risks do you see?",
      "Draft a submission checklist for Kiroween",
      "When is the FNB hackathon?",
      "How is the season going?",
    ];
    for (const q of questions) {
      for (const m of ask(q).reply.matchAll(
        /\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})\b/g,
      )) {
        const month = String(
          "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(m[2]!) / 3 + 1,
        ).padStart(2, "0");
        const iso = `${m[3]}-${month}-${m[1]!.padStart(2, "0")}`;
        expect(corpus, `${q} -> ${m[0]}`).toContain(iso);
      }
    }
  });
});

describe("rankForAction", () => {
  it("puts dated work inside a fortnight first, then the rest by score", () => {
    const ranked = rankForAction(snap.live, NOW).map((o) => o.id);
    expect(ranked[0]).toBe("samsung-dev-programme");
    expect(ranked[1]).toBe("mintek-sci-2026");
  });

  it("leaves out rows that need nothing more from the team", () => {
    expect(rankForAction(snap.live, NOW).map((o) => o.id)).not.toContain("sme-toolkit-2026");
  });

  it("leaves out rows whose dates have all passed", () => {
    expect(rankForAction(snap.live, NOW).map((o) => o.id)).not.toContain(
      "paypal-ai-hackathon-2026",
    );
  });
});

describe("matching", () => {
  it("needs a distinctive word, not a generic one", () => {
    expect(findMentioned("which hackathon should we enter", snap.live)).toEqual([]);
    expect(findMentioned("tell me about mintek", snap.live)).toEqual([mintek]);
  });

  it("reads capitalised words as a name, skipping the sentence opener", () => {
    expect(properTokens("What is the prize for the Standard Bank Fintech Cup?")).toEqual([
      "standard",
      "bank",
      "fintech",
      "cup",
    ]);
    expect(properTokens("when is bcg")).toEqual([]);
  });

  it("formats days without depending on the host timezone", () => {
    expect(formatDay("2026-11-22")).toBe("22 Nov 2026");
    expect(formatDay("2026-12-04T14:00:00-08:00")).toBe("4 Dec 2026");
    expect(formatDay("late October")).toBe("late October");
  });
});

describe("prompts", () => {
  it("carries every row's dated milestones and today's date", () => {
    const p = buildSystemPrompt(snap);
    expect(p).toContain("dates: submission_deadline=2026-12-04");
    expect(p).toContain("next_date=2026-12-04 (18 days away)");
    expect(p).toContain("Today is 2026-11-16.");
  });

  it("keeps free-text date hints out of the prompt", () => {
    expect(buildSystemPrompt(snap)).not.toContain("Late October");
  });

  it("marks an unreadable archive as unavailable rather than empty", () => {
    expect(buildSystemPrompt({ ...snap, pastUnavailable: true })).toMatch(
      /read failed — treat as unavailable, not as a confirmed empty archive/,
    );
  });

  it("builds a compact prompt with only the nearest dated rows", () => {
    const p = buildCompactPrompt(snap);
    expect(p).toContain("Samsung");
    expect(p).not.toContain("Mintek");
    expect(p.length).toBeLessThan(buildSystemPrompt(snap).length / 3);
  });
});
