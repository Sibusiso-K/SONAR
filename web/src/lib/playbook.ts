/**
 * How these competitions actually get won.
 *
 * Why this lives in the web app rather than in Supabase like the board does:
 * it is editorial reference content that changes when someone does new
 * research, not per-entry state that a pipeline writes. Putting it behind a
 * table + migration + sync would buy nothing and add three more things that
 * can silently go stale. It ships with the code and is reviewed in the diff.
 *
 * The rule the rest of SONAR follows applies here too: every claim names a
 * source. `evidence: "ours"` means we measured it ourselves and the source is
 * our own repo; `evidence: "external"` means somebody else published it and
 * the link is theirs. Nothing in this file is an unattributed opinion.
 */

export type Phase = "before" | "during" | "after";

/** Leaderboard-scored contests and judged pitch events reward genuinely
 * different behaviour. Merging them yields advice that is wrong for both:
 * "polish the demo" is noise on a scored leaderboard, and "match the local
 * scorer exactly" is meaningless when the scorer is a room of humans. */
export type Arena = "scored" | "judged" | "both";

export type PlaybookEntry = {
  id: string;
  phase: Phase;
  arena: Arena;
  /** The claim, stated as an instruction. Short enough to act on. */
  claim: string;
  /** Why it is true, and the number if there is one. */
  detail: string;
  evidence: "ours" | "external";
  source: string;
  sourceUrl: string;
};

export const PHASE_LABEL: Record<Phase, string> = {
  before: "Before",
  during: "During",
  after: "After",
};

export const ARENA_LABEL: Record<Arena, string> = {
  scored: "Leaderboard",
  judged: "Judged",
  both: "Both",
};

export const PLAYBOOK: PlaybookEntry[] = [
  /* ---------------- before ---------------- */
  {
    id: "rubric-first",
    phase: "before",
    arena: "judged",
    claim: "Read the judging rubric before the problem statement.",
    detail:
      "The weights tell you what to build. A 40% weighting on innovation rewards a clever approach; a heavy business-viability weighting means you owe them a pitch deck as well as a demo. Re-read it before every scoping decision, not once at the start.",
    evidence: "external",
    source: "AngelHack, what repeat winners do differently",
    sourceUrl: "https://angelhack.com/blog/hackathon-tips-for-winners/",
  },
  {
    id: "balanced-team",
    phase: "before",
    arena: "judged",
    claim: "Pick the team for balance, not for friendship.",
    detail:
      "One frontend, one backend, one person who can actually present. AngelHack's blunt version: a four-backend-developer team loses to a balanced three-person team almost every time.",
    evidence: "external",
    source: "AngelHack, what repeat winners do differently",
    sourceUrl: "https://angelhack.com/blog/hackathon-tips-for-winners/",
  },
  {
    id: "preconfigure",
    phase: "before",
    arena: "both",
    claim: "Arrive with the scaffold already built and tested end to end.",
    detail:
      "Boilerplate, deploy pipeline, API keys, a build you have run once. Teams that skip this lose the first six hours to setup. Entelect's own pre-event email asked for an app that reads input files, writes output files and runs quickly and repeatedly — they are telling you the workflow is iterate, not one clever run.",
    evidence: "external",
    source: "AngelHack; Entelect pre-event brief",
    sourceUrl: "https://angelhack.com/blog/hackathon-tips-for-winners/",
  },
  {
    id: "study-the-precedent",
    phase: "before",
    arena: "both",
    claim: "Find out how the last edition was won, specifically.",
    detail:
      "University Cup 2025 (MegaZoo Master Planner) went to Team Carrots, two UCT students, with a deterministic multi-pass packing algorithm ranked by interest-to-cost ratio. Not a genetic algorithm. The winning move in this competition family is a ratio-sorted greedy run in several passes.",
    evidence: "external",
    source: "UCT School of IT, Team Carrots win the University Cup",
    sourceUrl:
      "https://sit.uct.ac.za/articles/2025-09-15-team-carrots-win-entelect-challenge-university-cup",
  },
  {
    id: "most-teams-lose-early",
    phase: "before",
    arena: "both",
    claim: "Assume the event is decided in the first two hours, not the last.",
    detail:
      "The decisions that put a team on the leaderboard are usually made in the week before kickoff, while everyone else is still reading the invite email.",
    evidence: "external",
    source: "HackerEarth, tips drawn from 500+ events",
    sourceUrl: "https://www.hackerearth.com/blog/10-tips-win-hackathon",
  },

  /* ---------------- during ---------------- */
  {
    id: "ship-early",
    phase: "during",
    arena: "scored",
    claim: "Get something valid on the board inside the first 45 minutes.",
    detail:
      "A submission that scores 100 beats an unfinished one that would have scored 10,000. On the Entelect scorer only the best submission per level counts, so a weak upload cannot hurt you — there is no reason to hold back.",
    evidence: "ours",
    source: "Our Entelect playbook and the verified scoring rule",
    sourceUrl: "https://github.com/Sibusiso-K/optimisation-challenge",
  },
  {
    id: "skeleton-at-25pct",
    phase: "during",
    arena: "judged",
    claim: "Have a working skeleton at 25% of the clock.",
    detail:
      "Hour 6 of a 24-hour event, hour 12 of a 48. After that you are improving something rather than racing to finish something, which is a different and much safer job.",
    evidence: "external",
    source: "AngelHack, what repeat winners do differently",
    sourceUrl: "https://angelhack.com/blog/hackathon-tips-for-winners/",
  },
  {
    id: "local-scorer",
    phase: "during",
    arena: "scored",
    claim: "Build a local scorer that matches theirs exactly, then trust it.",
    detail:
      "Without one you are guessing; with one you can run thousands of iterations offline. Validate it against one real leaderboard submission. Kaggle's version of the same rule: trust your local validation over the public leaderboard, and treat the public board as just one more fold.",
    evidence: "external",
    source: "NVIDIA, Kaggle Grandmasters on winning strategies",
    sourceUrl:
      "https://developer.nvidia.com/blog/kaggle-grandmasters-unveil-winning-strategies-for-data-science-superpowers/",
  },
  {
    id: "greedy-then-search",
    phase: "during",
    arena: "scored",
    claim: "Greedy by value density first. Metaheuristics last, if ever.",
    detail:
      "Sort by value/cost, take while feasible, submit. That is usually 70-85% of optimal and it is what has actually won this competition. Local search on top of a scoring baseline is where the remaining points are.",
    evidence: "ours",
    source: "Our Entelect playbook, built on the Team Carrots precedent",
    sourceUrl: "https://github.com/Sibusiso-K/optimisation-challenge",
  },
  {
    id: "determinism",
    phase: "during",
    arena: "scored",
    claim: "Make the solver deterministic, and prove it.",
    detail:
      "Entelect re-runs your source and compares output. We verified identical objectives and md5 action-plan hashes across PYTHONHASHSEED 0/1/12345. Sort every set before iterating and give every min/max a tie-break, or a rerun quietly produces a different answer than the one you submitted.",
    evidence: "ours",
    source: "Our Entelect handover, determinism check",
    sourceUrl: "https://github.com/Sibusiso-K/optimisation-challenge",
  },
  {
    id: "sweep-dont-guess",
    phase: "during",
    arena: "scored",
    claim: "Sweep the discrete levers exhaustively instead of arguing about them.",
    detail:
      "On Enteland the full sweep killed two plausible hypotheses outright: the furniture-from-free-inputs idea (pottery beat it by 5.8M) and building earlier-doubling towns first (lost on all three levels). One of our own recorded claims, a 20.6% sell bonus, turned out to be a misattributed leaderboard row and had to be retracted. Measure, then believe.",
    evidence: "ours",
    source: "Our Entelect handover, measured-and-rejected list",
    sourceUrl: "https://github.com/Sibusiso-K/optimisation-challenge",
  },
  {
    id: "scope-one-thing",
    phase: "during",
    arena: "judged",
    claim: "Do one thing completely rather than five things halfway.",
    detail:
      "Judges name scope creep as the standard failure. Almost every losing team scoped too ambitiously. A long demo is itself the symptom — if it takes more than 90 seconds you have a scoping problem, not a presenting problem.",
    evidence: "external",
    source: "JetBrains, notes from the judging table",
    sourceUrl:
      "https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/",
  },
  {
    id: "demo-script-first",
    phase: "during",
    arena: "judged",
    claim: "Write the demo script before you write the code.",
    detail:
      "One page: the problem in a sentence, the current workaround, the trigger action, the moment it clicks, the impact line. Two hours of scripting typically saves six hours of building the wrong thing.",
    evidence: "external",
    source: "AngelHack, what repeat winners do differently",
    sourceUrl: "https://angelhack.com/blog/hackathon-tips-for-winners/",
  },
  {
    id: "lead-with-problem",
    phase: "during",
    arena: "judged",
    claim: "Spend roughly a third of the demo on the problem.",
    detail:
      "Winners give the problem about 30% of the demo against a typical 5%, framed around a specific person rather than a category. Judges see 30-100 demos and form an opinion in the first 30 seconds. Every judge interviewed named problem definition first; it is also the step most teams skip.",
    evidence: "external",
    source: "AngelHack; JetBrains judging notes",
    sourceUrl:
      "https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/",
  },
  {
    id: "ai-on-the-80",
    phase: "during",
    arena: "both",
    claim: "Use AI for the 80% that does not differentiate you. Write the 20% yourself.",
    detail:
      "Boilerplate, glue, scaffolding: delegate. Core logic: write it, because judges ask about it and can tell when you do not understand your own submission. Entelect run a Hack-ademy session on solving optimisation problems with AI, so this is endorsed rather than tolerated.",
    evidence: "external",
    source: "AngelHack; Entelect Hack-ademy",
    sourceUrl: "https://angelhack.com/blog/hackathon-tips-for-winners/",
  },
  {
    id: "lock-early",
    phase: "during",
    arena: "both",
    claim: "Stop coding well before the deadline and submit early.",
    detail:
      "Lock the code four hours out on a long event, record the demo twice as backup, walk the live path five times, submit 30 minutes early. Our own five-hour version: hard stop at 14:40 for a 15:00 deadline, whatever state the code is in.",
    evidence: "external",
    source: "AngelHack; our Entelect playbook",
    sourceUrl: "https://angelhack.com/blog/hackathon-tips-for-winners/",
  },
  {
    id: "watch-the-channel",
    phase: "during",
    arena: "both",
    claim: "Put one person on the announcements channel the whole time.",
    detail:
      "Rules clarifications posted mid-event change the optimal solution, and the answers get broadcast to everyone anyway, so asking early is free. On Entelect events everything runs through Discord.",
    evidence: "ours",
    source: "Our Entelect research, format confirmed across events",
    sourceUrl: "https://challenge.entelect.co.za/",
  },

  /* ---------------- after ---------------- */
  {
    id: "write-the-retro",
    phase: "after",
    arena: "both",
    claim: "Write the post-mortem while it is still fresh, including what failed.",
    detail:
      "Deliberate practice is: break the skill into parts, work one with full attention, get feedback, repeat. The feedback step is the one people skip, and it is the one that stops you plateauing. Our Enteland handover carries a measured-and-rejected list precisely so the next run does not re-test dead ends.",
    evidence: "external",
    source: "Deliberate practice in competitive programming",
    sourceUrl: "https://joaogui1.github.io/2018/07/31/comp-practice.html",
  },
  {
    id: "keep-the-asset",
    phase: "after",
    arena: "both",
    claim: "Keep the reusable half of what you built.",
    detail:
      "The scorer, the parser, the search kit and the submission harness outlive the event. Our Enteland repo shipped a reusable sequential-search kit; the next optimisation event starts from that rather than from an empty folder.",
    evidence: "ours",
    source: "Our Entelect repo structure",
    sourceUrl: "https://github.com/Sibusiso-K/optimisation-challenge",
  },
  {
    id: "record-the-number",
    phase: "after",
    arena: "both",
    claim: "Record the actual number, not the vibe.",
    detail:
      "We finished 3.85% behind the leader at freeze. That is a calibration point: this team is competitive at this level and loses on the last few percent, which is a tuning problem, not a capability problem. A board that only remembers 'we did well' cannot tell you that.",
    evidence: "ours",
    source: "Our Entelect handover, verified portal scores",
    sourceUrl: "https://github.com/Sibusiso-K/optimisation-challenge",
  },
  {
    id: "judges-are-recruiters",
    phase: "after",
    arena: "judged",
    claim: "Treat the submission as a work sample, because it is one.",
    detail:
      "Entelect run these as a graduate-hiring pipeline. Clean, readable, working code is worth more than a half-finished clever thing regardless of where you place, and the artefact keeps earning after the leaderboard closes.",
    evidence: "ours",
    source: "Our Entelect research, on why they run these",
    sourceUrl: "https://challenge.entelect.co.za/",
  },
];

/** Our own measured baseline. Kept beside the playbook because it is what
 * turns the advice into a target: these are the numbers to beat next time. */
export const BENCHMARK = {
  event: "Entelect University Cup 2, Age of Enteland",
  date: "2026-08-22",
  ourScore: 121_860_709,
  frozenScore: 120_444_763,
  leaderScore: 125_270_208,
  standing: "≈10th at leaderboard freeze",
  /** Deliberately explicit: the portal closed the leaderboard afterwards and
   * keeps no history, so the rank is the last thing we observed, not a
   * certified result, and the board should never render it as one. */
  standingConfirmed: false,
  levels: [
    { level: 1, score: 15_358_600 },
    { level: 2, score: 21_090_840 },
    { level: 3, score: 36_984_815 },
    { level: 4, score: 48_426_454 },
  ],
};

export function gapToLeaderPct() {
  return ((1 - BENCHMARK.frozenScore / BENCHMARK.leaderScore) * 100).toFixed(2);
}

export function shippedVsLeaderPct() {
  return ((BENCHMARK.ourScore / BENCHMARK.leaderScore) * 100).toFixed(2);
}
