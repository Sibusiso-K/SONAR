/**
 * SONAR's built-in answer engine.
 *
 * Not a language model. It reads the same board rows the language models are
 * given and answers the questions this assistant actually gets (what closes
 * next, what to prioritise, why a row scores what it does, what a submission
 * needs, what the risks are) by looking the answer up. It exists for three
 * reasons:
 *
 *   1. It always runs. No key, no quota, no network. Free model tiers are
 *      rate limited by the day (50 requests on an unfunded OpenRouter
 *      account), and an assistant that goes dark at request 51 is not one
 *      anybody relies on.
 *   2. It cannot invent a date. Every figure it prints is copied from a row.
 *   3. It gives the evaluation a floor: a language model has to beat this to
 *      earn its place in the chain (see docs/MODELS.md).
 *
 * What it cannot do is reason across rows in ways nobody anticipated, or
 * draft prose. It says so rather than guessing.
 */

import {
  collisions,
  daysUntil,
  expectedValueZar,
  formatMoney,
  seasonStats,
  toZar,
  winProbability,
  zar,
} from "@/lib/analytics";
import { kindLabel, LOCALE } from "@/lib/format";
import { participationBadge } from "@/lib/participation";
import { formatPrizeBreakdown } from "@/lib/prize";
import type { BoardSnapshot } from "@/lib/assistant.context";
import type { Opportunity, PastOpportunity } from "@/lib/sonar-types";

export type Intent =
  | "soonest"
  | "prioritise"
  | "explain-score"
  | "checklist"
  | "eligibility"
  | "prize"
  | "dates"
  | "risks"
  | "season"
  | "summary"
  | "past"
  | "ambiguous"
  | "not-found"
  | "out-of-scope"
  | "help";

export type BuiltinAnswer = { reply: string; intent: Intent };

export const BUILTIN_MODEL = "sonar-core-1";

/* ---------------- text helpers ---------------- */

const STOPWORDS = new Set(
  (
    "the and for with from that this what which when where who why how are was were will would should could can " +
    "our your their its his her you they them out about into over under than then there here have has had not " +
    "does did any all more most some much many next soon soonest now today week weeks month year day days " +
    "please tell show give draft write make list explain summarise summarize " +
    "deadline deadlines due close closes closing date dates prize prizes money pool score scores scored scoring " +
    "eligibility eligible checklist submission submit board row rows risk risks conflict conflicts clash " +
    "priority prioritise prioritize focus hackathon hackathons competition competitions challenge challenges " +
    "programme program opportunity opportunities event events way right worth enter apply applied team " +
    "january february march april june july august september october november december " +
    "monday tuesday wednesday thursday friday saturday sunday christmas sonar " +
    "one ones app apps new global annual"
  ).split(" "),
);

function tokens(text: string): string[] {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .match(/[a-z0-9]+/g) ?? []
  ).filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^20\d\d$/.test(t));
}

const dayFormat = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-11-22" -> "22 Nov 2026". Anything unparseable is returned as written. */
export function formatDay(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  if (!m) return key;
  const at = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(at.getTime()) ? key : dayFormat.format(at);
}

function away(days: number | null): string {
  if (days === null) return "no date on record";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

const SHAKY = new Set(["unconfirmed", "predicted", "conflicted"]);

/** The caveat rule 2 of the language-model prompt asks for, applied by code. */
function caveat(o: Opportunity): string {
  return SHAKY.has(o.confidence) ? ` [${o.confidence}: not calendar-safe]` : "";
}

const DONE = new Set(["submitted", "dropped", "closed", "past"]);

/** Rows the team can still act on. */
function actionable(o: Opportunity): boolean {
  return !DONE.has(String(o.status ?? ""));
}

/** ISO-dated milestones on a row that are still something to do, not history. */
function milestoneDays(o: Opportunity, now: Date): number[] {
  return Object.entries(o.dates ?? {})
    .filter(
      ([k, v]) =>
        k !== "confidence" &&
        !NOT_A_DEADLINE.test(k) &&
        typeof v === "string" &&
        /^\d{4}-\d{2}-\d{2}/.test(v),
    )
    .map(([, v]) => daysUntil(v, now))
    .filter((n): n is number => n !== null);
}

/**
 * A row with trusted dates, none of them in the future, that the board still
 * lists as something to act on. Either a result is pending or the row is
 * stale; both are worth a look and neither is work to prioritise.
 */
export function hasRunItsCourse(o: Opportunity, now: Date): boolean {
  if (o.next_date || !actionable(o) || SHAKY.has(o.confidence)) return false;
  const days = milestoneDays(o, now);
  return days.length > 0 && days.every((n) => n < 0);
}

function prizeText(o: Opportunity): string {
  const pool = o.prize?.pool;
  if (!pool) return "no cash pool recorded";
  const cur = (o.prize?.currency ?? "ZAR").toUpperCase();
  const base = formatMoney(pool, cur);
  return cur === "ZAR" ? base : `${base} (about ${zar(toZar(pool, cur))})`;
}

/* ---------------- matching a question to a row ---------------- */

type Named = { id: string; name: string; organiser: string };

function buildIndex<T extends Named>(rows: T[]) {
  const perRow = rows.map(
    (r) => new Set(tokens(`${r.name} ${r.organiser} ${r.id.replace(/-/g, " ")}`)),
  );
  const df = new Map<string, number>();
  for (const set of perRow) for (const t of set) df.set(t, (df.get(t) ?? 0) + 1);
  return { perRow, df };
}

/** One token shared by at most two rows is enough to bring a row up; shared by
 * two, the reader is asked which they meant. */
const MATCH_THRESHOLD = 0.5;

/** Keys in a row's `dates` that record history, not something still to happen. */
const NOT_A_DEADLINE = /prior|previous|last_year|checked|notified|announced|start|opens?$/i;

/**
 * Words the question writes as a name: capitalised, and not merely because
 * they open the sentence. "What is the prize for the Standard Bank Fintech
 * Cup?" names four. Used to tell "asked about a row we do not have" apart
 * from "asked about the board".
 */
export function properTokens(question: string): string[] {
  const words = question.match(/[A-Za-z0-9][\w&-]*/g) ?? [];
  return words
    .slice(1)
    .filter((w) => /^[A-Z]/.test(w))
    .flatMap((w) => tokens(w));
}

/**
 * Rows a question names, best first. A token counts for more the fewer rows
 * share it ("bcg" names one row; "africa" names several), and a match needs
 * roughly one token unique to the row, so a generic word cannot select one.
 * When the question spells out a name, at least half of that name has to be
 * in the row: "Standard Bank Fintech Cup" must not land on "Imagine Cup"
 * because both end in the same word.
 */
export function findMentioned<T extends Named>(question: string, rows: T[]): T[] {
  const q = new Set(tokens(question));
  if (q.size === 0 || rows.length === 0) return [];
  const proper = properTokens(question);
  const { perRow, df } = buildIndex(rows);
  const scored = rows
    .map((row, i) => {
      const own = perRow[i]!;
      let score = 0;
      for (const t of q) if (own.has(t)) score += 1 / (df.get(t) ?? 1);
      const named = proper.filter((t) => own.has(t)).length;
      const covers = proper.length === 0 || named * 2 >= proper.length;
      return { row, score: covers ? score : 0 };
    })
    .filter((s) => s.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return [];
  const best = scored[0]!.score;
  return scored.filter((s) => s.score >= best * 0.8).map((s) => s.row);
}

/* ---------------- intent ---------------- */

const RX = {
  checklist: /\bcheck\s?list\b|what (do|would) we need to (submit|send|hand in)|\bdeliverables?\b/i,
  explain:
    /\bwhy\b.*\bscor|\bscor\w*\b.*\b(why|explain|breakdown|way)\b|how (is|was|are) .*scored|explain .*scor/i,
  eligibility:
    /\beligib|\bqualif|can we (enter|apply|join|take part)|who can (enter|apply)|allowed to enter/i,
  prize: /\bprizes?\b|\bmoney\b|\bpool\b|\bpay(s|out)?\b|how much|\bworth\b|expected value/i,
  dates: /\bwhen\b|\bdeadlines?\b|\bdue\b|\bcloses?\b|\bclosing\b|\bdates?\b|how long/i,
  soonest:
    /\bsoon(est)?\b|\bnext\b|\bupcoming\b|\bclos(es|ing)\b|\bdue\b|this (week|month)|next (week|month)|\bdeadlines?\b|\bcalendar\b/i,
  prioritise:
    /\bpriorit|\bfocus\b|what (should|do) we (do|work on|build)|\brecommend|\bbest\b|\btop\b|\brank|worth (our|the) time|which (one|opportunit)/i,
  risks:
    /\bconflict|\bclash|\bcollision|\brisks?\b|\bstale\b|\bunconfirmed\b|\bverify\b|\bworr(y|ied)\b|\bproblem/i,
  season:
    /\bstats?\b|\bseason\b|how many\b|\bwon\b|\bwins?\b|\bplaced\b|\bmissed\b|track record|\bresults?\b|\barchive\b|so far|\bpast\b/i,
  scope:
    /\bboard\b|\bsonar\b|opportunit|hackathon|competition|fellowship|programme|\bgrant\b|\bsubmit|\bregister|\bapply|\bapplication/i,
};

function wantsThisWeek(q: string): number | null {
  if (/this week|next 7 days|coming week/i.test(q)) return 7;
  if (/next week|two weeks|fortnight|next 14 days/i.test(q)) return 14;
  if (/this month|next month|30 days/i.test(q)) return 30;
  return null;
}

/* ---------------- answers ---------------- */

function line(o: Opportunity, now: Date): string {
  const d = daysUntil(o.next_date, now);
  const when = o.next_date ? `${formatDay(o.next_date)}, ${away(d)}` : "no date on record";
  return `- ${o.name}: ${when}${caveat(o)}. ${participationBadge(o.status).label}, score ${o.score}.`;
}

function soonest(live: Opportunity[], now: Date, within: number | null): string {
  const dated = live
    .map((o) => ({ o, d: daysUntil(o.next_date, now) }))
    .filter((x): x is { o: Opportunity; d: number } => x.d !== null && x.d >= 0)
    .sort((a, b) => a.d - b.d);
  const undated = live.filter((o) => !o.next_date).length;
  const pool = within === null ? dated.slice(0, 5) : dated.filter((x) => x.d <= within);

  if (dated.length === 0) {
    return `No live row has an upcoming date on record. ${undated} live rows have no next date at all, which is a gap to close before trusting the calendar.`;
  }
  if (pool.length === 0) {
    const first = dated[0]!;
    return [
      `Nothing on the board falls due in the next ${within} days.`,
      `The nearest date is ${first.o.name}: ${formatDay(first.o.next_date!)}, ${away(first.d)}${caveat(first.o)}.`,
    ].join("\n");
  }
  const head =
    within === null
      ? "Nearest dates on the live board:"
      : `Due in the next ${within} days (${pool.length}):`;
  const tail =
    undated > 0
      ? `\n\n${undated} other live rows have no next date recorded, so they cannot appear here.`
      : "";
  return `${head}\n${pool.map((x) => line(x.o, now)).join("\n")}${tail}`;
}

/**
 * Ranking for "what should we work on". Anything due within a fortnight that
 * still needs action comes first, nearest first, because a deadline is a
 * fact and a score is an opinion. The rest follow by board score.
 */
export function rankForAction(live: Opportunity[], now: Date): Opportunity[] {
  const open = live.filter((o) => actionable(o) && !hasRunItsCourse(o, now));
  const urgent = open
    .map((o) => ({ o, d: daysUntil(o.next_date, now) }))
    .filter((x): x is { o: Opportunity; d: number } => x.d !== null && x.d >= 0 && x.d <= 14)
    .sort((a, b) => a.d - b.d || b.o.score - a.o.score)
    .map((x) => x.o);
  const rest = open
    .filter((o) => !urgent.includes(o))
    .filter((o) => {
      const d = daysUntil(o.next_date, now);
      return d === null || d >= 0;
    })
    .sort((a, b) => b.score - a.score);
  return [...urgent, ...rest];
}

function prioritise(live: Opportunity[], now: Date): string {
  const ranked = rankForAction(live, now).slice(0, 3);
  if (ranked.length === 0) return "Nothing on the live board still needs action from us.";
  const rows = ranked.map((o, i) => {
    const d = daysUntil(o.next_date, now);
    const why: string[] = [];
    if (d !== null && d <= 14) why.push(`due ${away(d)} (${formatDay(o.next_date!)})`);
    else if (o.next_date) why.push(`next date ${formatDay(o.next_date)}`);
    else why.push("no date on record, so the first job is finding one");
    why.push(`board score ${o.score}`);
    why.push(`win chance about ${winProbability(o)}/100`);
    if (o.prize?.pool) why.push(`pool ${prizeText(o)}`);
    return `${i + 1}. ${o.name}${caveat(o)} — ${why.join("; ")}. Status: ${participationBadge(o.status).label}.`;
  });
  return [
    "In order, counting only rows that still need something from us:",
    ...rows,
    "",
    "Dated work within a fortnight is ranked first; the rest follow by board score. Win chance is a ranking device, not a forecast.",
  ].join("\n");
}

function explainScore(o: Opportunity): string {
  const s = o.scores ?? {};
  const parts = [
    ["career leverage", s.career_leverage],
    ["winnability", s.winnability],
    ["prize", s.prize],
    ["urgency", s.urgency],
  ]
    .filter((p): p is [string, number] => typeof p[1] === "number")
    .map(([k, v]) => `- ${k}: ${v}`);
  const out = [`${o.name} scores ${o.score} overall (tier ${o.tier}).${caveat(o)}`];
  if (parts.length) out.push("The four inputs on record:", ...parts);
  else out.push("No component scores are recorded for this row, only the total.");
  out.push(
    `Derived from those: win chance about ${winProbability(o)}/100, expected value ${zar(expectedValueZar(o))}. Both are ranking devices, not forecasts.`,
  );
  if (o.notes)
    out.push(`Notes on the row: ${o.notes.slice(0, 280)}${o.notes.length > 280 ? "…" : ""}`);
  return out.join("\n");
}

function datesOf(o: Opportunity, now: Date): string[] {
  return Object.entries(o.dates ?? {})
    .filter(([k, v]) => k !== "confidence" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v))
    .sort((a, b) => (a[1] < b[1] ? -1 : 1))
    .map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${formatDay(v)} (${away(daysUntil(v, now))})`);
}

function dates(o: Opportunity, now: Date): string {
  const all = datesOf(o, now);
  const head = o.next_date
    ? `${o.name}: next date ${formatDay(o.next_date)}, ${away(daysUntil(o.next_date, now))}.${caveat(o)}`
    : `${o.name} has no upcoming date on record.${caveat(o)}`;
  const conf = `Date confidence: ${o.confidence}.`;
  return [head, conf, ...(all.length ? ["All dates on the row:", ...all] : [])].join("\n");
}

function eligibility(o: Opportunity): string {
  if (!o.eligibility) {
    return `The board has no eligibility rule recorded for ${o.name}. It needs to be read off the organiser's page${
      o.links?.["main"] ? ` (${o.links["main"]})` : ""
    } before anyone assumes we qualify.`;
  }
  return [
    `Eligibility recorded for ${o.name}:${caveat(o)}`,
    o.eligibility,
    `Format ${o.format}, scope ${o.scope}. This is what the row says; the organiser's page is the authority.`,
  ].join("\n");
}

function prize(o: Opportunity): string {
  const out = [`${o.name}: ${prizeText(o)}.${caveat(o)}`];
  const breakdown = formatPrizeBreakdown(o.prize?.breakdown, o.prize?.currency);
  if (breakdown) out.push(`Breakdown: ${breakdown}.`);
  const extras = (o.prize?.non_cash ?? []).map((n) => `- ${n.description}`);
  if (extras.length) out.push("Non-cash:", ...extras);
  if (o.prize?.pool) {
    out.push(
      `Expected value at a win chance of about ${winProbability(o)}/100: ${zar(expectedValueZar(o))}. A ranking device, not a forecast.`,
    );
  }
  return out.join("\n");
}

function biggestPrizes(live: Opportunity[]): string {
  const ranked = live
    .filter((o) => o.prize?.pool)
    .sort((a, b) => toZar(b.prize.pool, b.prize.currency) - toZar(a.prize.pool, a.prize.currency))
    .slice(0, 5);
  if (ranked.length === 0) return "No live row has a cash pool recorded.";
  return [
    "Largest recorded pools on the live board:",
    ...ranked.map((o) => `- ${o.name}: ${prizeText(o)}${caveat(o)}`),
    "",
    "Pools are whole-event totals, not what one team takes home.",
  ].join("\n");
}

function checklist(o: Opportunity, now: Date): string {
  const out = [
    `Submission checklist for ${o.name}, built only from what the row records.${caveat(o)}`,
  ];
  out.push("", "Dates:");
  const all = datesOf(o, now);
  out.push(...(all.length ? all : ["- none on record: find and confirm the deadline first"]));
  out.push("", "Deliverables:");
  const items = (o.deliverables ?? "")
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
  out.push(
    ...(items.length
      ? items.map((s) => `- [ ] ${s}`)
      : ["- none recorded: read them off the organiser's rules before starting"]),
  );
  out.push("", "Before submitting:");
  out.push(
    `- [ ] Eligibility checked${o.eligibility ? `: ${o.eligibility.slice(0, 160)}${o.eligibility.length > 160 ? "…" : ""}` : " (nothing recorded, verify at source)"}`,
  );
  out.push("- [ ] One named owner per deliverable");
  out.push("- [ ] Feature freeze four days out; submit a day early (docs/TEAM.md)");
  if (o.links?.["main"]) out.push(`- [ ] Re-read the rules at ${o.links["main"]}`);
  out.push("", `Status on the board: ${participationBadge(o.status).label}.`);
  return out.join("\n");
}

function risks(live: Opportunity[], now: Date): string {
  const out: string[] = [];
  const clashes = collisions(live);
  if (clashes.length) {
    out.push("Weeks with more than one committed date:");
    out.push(
      ...clashes.map((c) => `- Week of ${c.weekLabel}: ${c.items.map((i) => i.name).join(" + ")}`),
    );
  } else {
    out.push("No two confirmed or reported dates fall in the same week.");
  }

  const shaky = live.filter((o) => SHAKY.has(o.confidence));
  if (shaky.length) {
    out.push("", `Not calendar-safe (${shaky.length}):`);
    out.push(...shaky.slice(0, 8).map((o) => `- ${o.name}: ${o.confidence}`));
    if (shaky.length > 8) out.push(`- and ${shaky.length - 8} more`);
  }

  const lapsed = live.filter((o) => {
    const d = daysUntil(o.next_date, now);
    return d !== null && d < 0;
  });
  if (lapsed.length) {
    out.push("", "Next date already passed, so the row is stale:");
    out.push(...lapsed.map((o) => `- ${o.name}: ${formatDay(o.next_date!)}`));
  }

  const overdue = live.filter((o) => hasRunItsCourse(o, now));
  if (overdue.length) {
    out.push("", "Every dated milestone has passed (a result is pending, or the row is stale):");
    out.push(...overdue.map((o) => `- ${o.name}`));
  }

  const undated = live.filter((o) => !o.next_date && actionable(o) && !overdue.includes(o));
  if (undated.length) {
    out.push("", `Still open with no date on record (${undated.length}):`);
    out.push(...undated.slice(0, 8).map((o) => `- ${o.name}`));
    if (undated.length > 8) out.push(`- and ${undated.length - 8} more`);
  }
  return out.join("\n");
}

function season(snap: BoardSnapshot): string {
  if (snap.pastUnavailable) {
    return "The archive could not be read just now, so season totals would be wrong. Try again shortly.";
  }
  const s = seasonStats(snap.live, snap.past);
  const out = [
    `Season so far: ${s.discovered} tracked in total, ${snap.live.length} live. Entered ${s.entered}, placed ${s.placed}, won ${s.won}, missed ${s.missed}.`,
    `Recorded prize pools on the live board come to ${zar(s.totalPoolZar)}. Average discovery lag is ${s.avgLag} days.`,
  ];
  const results = snap.past.filter((p) => p.placement || p.outcome === "won");
  if (results.length) {
    out.push("", "Results on record:");
    out.push(...results.map((p) => `- ${pastLine(p)}`));
  }
  return out.join("\n");
}

function pastLine(p: PastOpportunity): string {
  const when = p.happened_on ? formatDay(p.happened_on) : "date unknown";
  const note = p.correction_note ?? "";
  const fix =
    p.corrected && note ? ` Corrected: ${note.slice(0, 140)}${note.length > 140 ? "…" : ""}` : "";
  return `${p.name} (${when}): ${p.outcome}${p.placement ? `, ${p.placement}` : ""}.${fix}`;
}

function summary(o: Opportunity, now: Date): string {
  return [
    `${o.name} — ${o.organiser}. ${kindLabel(o.kind)}, ${o.format}, ${o.scope}, tier ${o.tier}.${caveat(o)}`,
    o.next_date
      ? `Next date ${formatDay(o.next_date)}, ${away(daysUntil(o.next_date, now))}. Confidence: ${o.confidence}.`
      : `No upcoming date on record. Confidence: ${o.confidence}.`,
    `Score ${o.score}; status ${participationBadge(o.status).label}; prize ${prizeText(o)}.`,
    o.what_to_build ? `What to build: ${o.what_to_build}` : "",
    "Ask for its checklist, eligibility, dates, prize or score for more.",
  ]
    .filter(Boolean)
    .join("\n");
}

const HELP =
  "I answer from the board's rows: what closes next, what to prioritise, why a row scores what it does, eligibility, prizes, a submission checklist, and conflicts or stale rows. Name an opportunity, or ask for one of those.";

/* ---------------- entry point ---------------- */

/**
 * Answer the newest question in a conversation. Earlier user turns are only
 * used to resolve "it": a follow-up that names no row inherits the row the
 * conversation was last about.
 */
export function answerBuiltin(
  conversation: readonly { role: "user" | "assistant" | "system"; content: string }[],
  snap: BoardSnapshot,
): BuiltinAnswer {
  const now = snap.now ?? new Date();
  const userTurns = conversation.filter((m) => m.role === "user").map((m) => m.content);
  const question = userTurns[userTurns.length - 1] ?? "";
  const q = question.trim();
  if (!q) return { reply: HELP, intent: "help" };

  // Live and archived rows are matched together, so the row that fits the
  // name best wins wherever it lives. Matched separately, "the IBM Dev Day
  // hackathon" landed on a live row whose id happens to contain "dev".
  const liveIds = new Set(snap.live.map((o) => o.id));
  const hits = findMentioned<Opportunity | PastOpportunity>(q, [...snap.live, ...snap.past]);
  let mentioned = hits.filter((r): r is Opportunity => liveIds.has(r.id) && "archived" in r);
  const mentionedPast =
    mentioned.length === 0 ? hits.filter((r): r is PastOpportunity => "outcome" in r) : [];
  if (mentioned.length === 0 && mentionedPast.length === 0) {
    for (let i = userTurns.length - 2; i >= 0 && mentioned.length === 0; i--) {
      // Only a follow-up inherits a subject: a question with its own intent
      // words but no named row ("what closes soonest?") is about the board.
      if (!/\b(it|its|that one|this one|they|them|the same)\b/i.test(q)) break;
      mentioned = findMentioned(userTurns[i]!, snap.live);
    }
  }

  const rowIntent = RX.checklist.test(q)
    ? "checklist"
    : RX.explain.test(q)
      ? "explain-score"
      : RX.eligibility.test(q)
        ? "eligibility"
        : RX.prize.test(q)
          ? "prize"
          : RX.dates.test(q)
            ? "dates"
            : null;

  if (mentioned.length > 1) {
    return {
      intent: "ambiguous",
      reply: `That could be more than one row: ${mentioned
        .slice(0, 4)
        .map((o) => o.name)
        .join("; ")}. Which one?`,
    };
  }

  const one = mentioned[0];
  if (one) {
    switch (rowIntent) {
      case "checklist":
        return { intent: "checklist", reply: checklist(one, now) };
      case "explain-score":
        return { intent: "explain-score", reply: explainScore(one) };
      case "eligibility":
        return { intent: "eligibility", reply: eligibility(one) };
      case "prize":
        return { intent: "prize", reply: prize(one) };
      case "dates":
        return { intent: "dates", reply: dates(one, now) };
      default:
        return { intent: "summary", reply: summary(one, now) };
    }
  }

  if (mentionedPast.length > 0) {
    return {
      intent: "past",
      reply: [
        "That one is in the archive, not on the live board.",
        ...mentionedPast.slice(0, 3).map(pastLine),
      ].join("\n"),
    };
  }

  // A question about one specific row that the board does not carry. Saying
  // so beats answering about the whole board as if that were what was asked.
  const named = properTokens(q).length;
  const aboutOneRow =
    rowIntent === "checklist" ||
    rowIntent === "explain-score" ||
    rowIntent === "eligibility" ||
    rowIntent === "prize";
  if (named >= 2 || (named >= 1 && aboutOneRow)) {
    return {
      intent: "not-found",
      reply:
        "No row on the board matches that name, so there is nothing recorded to answer from. Check the spelling; it may also simply not be tracked yet.",
    };
  }

  if (RX.risks.test(q)) return { intent: "risks", reply: risks(snap.live, now) };
  if (RX.prioritise.test(q)) return { intent: "prioritise", reply: prioritise(snap.live, now) };
  if (rowIntent === "prize") return { intent: "prize", reply: biggestPrizes(snap.live) };
  if (RX.season.test(q)) return { intent: "season", reply: season(snap) };
  if (RX.soonest.test(q) || rowIntent === "dates") {
    return { intent: "soonest", reply: soonest(snap.live, now, wantsThisWeek(q)) };
  }

  if (/^\s*(hi|hello|hey|howzit|sawubona|dumela|good (morning|afternoon|evening))\b/i.test(q)) {
    return { intent: "help", reply: HELP };
  }

  if (!RX.scope.test(q)) {
    return {
      intent: "out-of-scope",
      reply: `That is outside what this assistant does. ${HELP}`,
    };
  }
  return { intent: "help", reply: `${HELP}\n\n${soonest(snap.live, now, null)}` };
}
