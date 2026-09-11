import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Reveal, RevealWords } from "@/components/Reveal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/war-room")({
  head: () => ({
    meta: [
      { title: "War Room: four weekends, one team | SONAR" },
      {
        name: "description",
        content:
          "Entelect Hack<IT>, GovTech, Geekulcha and Mintek, back to back over three weeks: what each one actually rewards, what we're bringing in, and what's still unresolved.",
      },
      { property: "og:title", content: "War Room: four weekends, one team | SONAR" },
      {
        property: "og:description",
        content:
          "Only one of the four is a leaderboard fight. The other three are judged pitches. The event-by-event prep plan.",
      },
    ],
  }),
  component: WarRoom,
});

/* ---------------- data ---------------- */

type Arena = "scored" | "judged";

type TimelineEntry = {
  day: string;
  name: string;
  venue: string;
  arena: Arena;
  who: string;
  flag?: string;
};

const TIMELINE: TimelineEntry[] = [
  {
    day: "Sat 12 Sep",
    name: "Entelect Hack<IT>",
    venue: "Venue TBA · 10:00–15:00",
    arena: "scored",
    who: "Solo",
  },
  {
    day: "Thu 17 – Sun 20 Sep",
    name: "GovTech 2026",
    venue: "Remote / online",
    arena: "judged",
    who: "PILOT CORE",
  },
  {
    day: "Fri 25 – Sun 27 Sep",
    name: "Geekulcha #GKHack26",
    venue: "BCX HQs, Centurion",
    arena: "judged",
    who: "Team SONAR",
  },
  {
    day: "Thu 1 – Fri 2 Oct",
    name: "Mintek-SCi",
    venue: "Randburg · build to 13:00",
    arena: "judged",
    who: "REEFPRINT",
  },
];

type Dossier = {
  n: number;
  name: string;
  tagline: string;
  meta: string;
  when: string;
  what: string;
  arena: Arena;
  wins: { text: string; source: string };
  assets: string[];
  risk: string;
  move: string;
};

const DOSSIERS: Dossier[] = [
  {
    n: 1,
    name: "Entelect Hack<IT> Community Cup",
    tagline: "R70,000 · 4 days out",
    meta: "Tech: AI/C/C++/C#/Go/Java/Python/Rust · Field: unpublished",
    when: "SAT 12 SEP · 10:00–15:00 SAST",
    what: "Highest score on the leaderboard, five hours, solo",
    arena: "scored",
    wins: {
      text: "Confirmed straight from the University Cup 2 result three weeks ago: this organiser runs optimisation-under-time-pressure, best-objective-wins, no pitch involved. The team's own retro found the winning move is a ratio-sorted greedy pass, run several times, with local search only after a valid submission exists — not a clever algorithm built in isolation and submitted once at the end.",
      source: "Our own Entelect handover, University Cup 2 (≈10th, 3.85% behind leader)",
    },
    assets: [
      "The solver kit from University Cup 2 — exact TSP DP, branch-and-bound, ILS, multistart, knapsack DP, Hungarian, beam search — 107 self-tests green",
      "A rehearsed upload/score loop from the live Practice Hackathon",
      "Proven determinism discipline (hash-checked across PYTHONHASHSEED 0/1/12345 last time — do it again before the clock starts)",
    ],
    risk: "Rules and leaderboard tabs are still locked four days out — team size, resubmission policy and the scoring formula are all unknown. “Community Cup” (vs “University Cup”) may open the field beyond students, which is the one variable that could genuinely change the odds.",
    move: "Get a valid submission on the board in the first 45 minutes, whatever its score — a weak upload can't hurt you if only the best submission counts, and it can't help you if it never lands. Then greedy pass, then local search. Don't touch the algorithm library until something is already on the leaderboard.",
  },
  {
    n: 2,
    name: "SITA GovTech 2026",
    tagline: "Remote · selected",
    meta: "Entity: PILOT CORE (PTY) LTD · Team: Sibusiso, Lethabo, Ipeleng",
    when: "THU 17 – SUN 20 SEP · REMOTE (was in-person Durban ICC, changed 11 Sept)",
    what: "A public-sector problem you won't see until day one",
    arena: "judged",
    wins: {
      text: "SITA shares its adjudication criteria on the first morning, not before — so this isn't a build-the-right-thing-in-advance event. What's public: winning solutions have to show clear engagement with a real, current South African socio-economic problem, not a generic tech demo retrofitted to a government theme.",
      source: "SITA GovTech public judging notes; T&Cs read 17 Aug",
    },
    assets: [
      "Three-person, EME-registered entity already cleared on eligibility",
      "Now remote — no travel/accommodation cost, but the team must actively guard against split attention across three locations",
      "Fresh off Entelect five days earlier: the “valid submission fast, iterate after” reflex transfers even though the game itself doesn't",
    ],
    risk: "Reply confirming attendance is due 11 Sept. IP terms are also worth a five-minute re-read: SITA takes an irrevocable worldwide licence over Hackathon Outputs, and pre-existing background IP only stays yours if it's flagged before or at time of use.",
    move: "Send the reply before the deadline. On day one, don't start coding until someone has written the one-sentence version of the problem and named the specific person it helps — that's the sentence the demo opens with on day four.",
  },
  {
    n: 3,
    name: "Geekulcha #GKHack26",
    tagline: "BCX HQs Centurion · selected, physical",
    meta: "Docs: 9 of 9 submitted · Sponsors: Telkom · CPSI · Red Bull",
    when: "FRI 25, 16:00 – SUN 27, 15:00",
    what: "V.U.K.A. — Blockchain for Impact, out of 394 teams",
    arena: "judged",
    wins: {
      text: "Geekulcha's own theme framing (2025: “Harnessing Intelligence for Sustainable Development”) rewards solutions judges can call technically viable, ethically sound and socially inclusive in one breath — not the most technically ambitious build in the room. With up to 50 solutions and six judging rooms in past years, a judge spends minutes with you, not hours.",
      source: "Geekulcha public event pages, prior editions",
    },
    assets: [
      "Every required document already filed: pitch deck, gap analysis, SLDC, full system architecture",
      "A direct steer from the organiser's own selection email, which is rare and worth following literally",
    ],
    risk: "The selection email names three specific gaps: V.U.K.A. currently reads as more AI-driven than consumer-facing, has no work breakdown structure yet, and needs to reach Technology Readiness Level 4 before the 25th. Treat it as the actual brief, since it came from the people scoring you.",
    move: "Before build weekend: rewrite the one-line pitch so a non-technical judge hears “what this does for someone,” not “what model it runs.” Produce the WBS. Push the prototype to TRL 4. All three are homework, not hackathon-weekend work.",
  },
  {
    n: 4,
    name: "Mintek-SCi Grad Hackathon",
    tagline: "Randburg · R50,000 pool",
    meta: "Prize: R25k / R15k / R10k · Next: SCI Conference, 2 Oct",
    when: "THU 1 OCT · build to 13:00, present 14:00",
    what: "REEFPRINT — mineralogical characterisation by optical proxy",
    arena: "judged",
    wins: {
      text: "2025's winner, H2Optimise (UJ), paired real mining-engineering domain knowledge with a data-driven model on a genuine operational problem — mine-water reprocessing, framed in cost and sustainability terms an industry judge already cares about. Judging runs on innovation, feasibility, impact, technical execution and presentation clarity, in that order of what actually differentiates entries.",
      source: "Mintek-SCi 2025 results (UJ News); Mintek's own judging criteria",
    },
    assets: [
      "Already the sharpest domain framing on the board: five named Bushveld phases, sub-1% base-metal-sulphide recall reported honestly rather than buried in an aggregate number",
      "Costs already in Rand and tCO2e against real gazetted Eskom/carbon-tax rates — exactly the register H2Optimise won on",
      "Positioned as a StarCS/FloatStar/MillStar module, not a rip-and-replace pitch to an industry that hates those",
    ],
    risk: "This is the fourth weekend in three weeks and the only one with a hard same-day code freeze at 13:00 followed by presenting at 14:00 — zero recovery time if the team is running on fumes by 1 October. An MOTT IP assessment follows before any result is final.",
    move: "Protect this slot specifically: this is the highest-scoring entry on the whole board (7.95) and the one most explicitly aimed at your actual situation. Bank sleep before it, not after Geekulcha. Rehearse the 10-minute presentation once, out loud, before the day arrives.",
  },
];

const RULES: { evidence: "ours" | "external"; title: string; body: string }[] = [
  {
    evidence: "ours",
    title: "The decisions that matter happen before kickoff",
    body: "Every prep task below is due before its weekend starts, not during it. Read this page as the to-do list for the week, not the weekend.",
  },
  {
    evidence: "external",
    title: "Arrive with the scaffold built",
    body: "Teams that skip a tested deploy pipeline lose the first six hours to setup. Entelect and GovTech both reward showing up with a build you've already run once — not a blank repo.",
  },
  {
    evidence: "external",
    title: "Judged rooms are decided in 30 seconds",
    body: "For GovTech, Geekulcha and Mintek: judges see dozens of demos and form an opinion almost immediately. Open with the problem, named around one specific person — not with the tech stack.",
  },
  {
    evidence: "ours",
    title: "A submission that scores 100 beats one that would've scored 10,000",
    body: "True at Entelect specifically, worth carrying everywhere: get something valid in early. An unfinished, unsubmitted idea is worth exactly nothing regardless of how good it would have been.",
  },
];

type CheckItem = { severity: "critical" | "warning"; title: string; note: string; due: string };

const CHECKLIST: CheckItem[] = [
  {
    severity: "critical",
    title: "Confirm attendance with SITA",
    note: "Reply required to lock the GovTech seat and roster",
    due: "Due 11 Sep",
  },
  {
    severity: "warning",
    title: "Push V.U.K.A. to TRL 4 + write the WBS",
    note: "Named directly in Geekulcha's own selection email",
    due: "By 25 Sep",
  },
  {
    severity: "warning",
    title: "Re-run the determinism check on the solver kit",
    note: "Hash-verify across PYTHONHASHSEED 0/1/12345 before the Entelect clock starts",
    due: "Sat 12 Sep",
  },
];

/* ---------------- page ---------------- */

function WarRoom() {
  return (
    <AppShell>
      <section className="mx-auto max-w-[88rem] px-5 pb-12 pt-16 md:px-10 md:pt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <p className="label-caps">War room</p>
          <p className="label-caps tabular-nums">12 Sep – 2 Oct 2026</p>
        </div>
        <h1 className="display-xl mt-5 max-w-[16ch]">
          <RevealWords text="Four hackathons. Three weeks. One team of three." />
        </h1>
        <Reveal delay={200}>
          <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Entelect Hack&lt;IT&gt;, GovTech, Geekulcha and Mintek land back to back, starting this
            Saturday.{" "}
            <strong className="font-semibold text-foreground">
              Only one of the four is a leaderboard fight — the other three are judged pitches.
            </strong>{" "}
            That single fact should drive most of what you do differently in each one. What each
            event actually rewards, what we're bringing into it, and what still needs closing before
            the weekend starts.
          </p>
        </Reveal>
      </section>

      {/* ---- timeline ---- */}
      <section className="mx-auto max-w-[88rem] px-5 md:px-10">
        <div className="overflow-x-auto">
          <div className="grid min-w-[46rem] grid-cols-4 gap-px bg-rule border border-rule">
            {TIMELINE.map((t) => (
              <div key={t.name} className="bg-paper p-5">
                <p className="font-mono text-xs font-semibold tabular-nums text-accent">
                  {t.day.toUpperCase()}
                </p>
                <p className="mt-1.5 font-display text-base font-bold leading-tight">{t.name}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{t.venue}</p>
                <span
                  className={cn(
                    "mt-3 inline-block border px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
                    t.arena === "scored"
                      ? "border-accent text-accent"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {t.arena === "scored" ? "Scored" : "Judged"} · {t.who}
                </span>
                {t.flag && (
                  <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-critical">
                    <span aria-hidden>▲</span> {t.flag}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="paper-panel mt-8 border-l-[3px] border-l-accent p-6 md:p-7">
          <p className="label-caps text-accent">The one thing to internalise before Saturday</p>
          <p className="mt-2.5 max-w-3xl text-[15px] leading-relaxed">
            <strong className="font-semibold">Entelect</strong> is a pure score-chaser — best
            objective value on a leaderboard wins, nobody in the room cares how you explain it.{" "}
            <strong className="font-semibold">GovTech, Geekulcha and Mintek</strong> are the
            opposite game: a human panel scores narrative, feasibility and how well you present, and
            a technically weaker team with a sharper pitch beats you every time. Walking into a
            judged room with a scored mindset — heads-down building, no rehearsed demo — is the
            single most avoidable way to lose three of these four.
          </p>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Source: this board's own Playbook, cross-checked against public judging notes for each
            organiser below.
          </p>
        </div>
      </section>

      {/* ---- dossiers ---- */}
      {DOSSIERS.map((d) => (
        <section key={d.n} className="mx-auto max-w-[88rem] scroll-mt-24 px-5 pt-16 md:px-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-2xl font-bold">
              {d.n} · {d.name}
            </h2>
            <span className="label-caps tabular-nums">{d.tagline}</span>
          </div>

          <div className="paper-panel mt-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule p-6">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{d.when}</p>
                <h3 className="mt-1 text-xl font-bold leading-snug">{d.what}</h3>
                <p className="mt-1.5 font-mono text-xs text-muted-foreground">{d.meta}</p>
              </div>
              <span
                className={cn(
                  "h-fit whitespace-nowrap border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
                  d.arena === "scored"
                    ? "border-accent text-accent"
                    : "border-border text-muted-foreground",
                )}
              >
                {d.arena === "scored" ? "Scored arena" : "Judged arena"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="border-b border-rule p-6 md:border-b-0 md:border-r">
                <p className="label-caps mb-2.5">What actually wins this</p>
                <p className="text-[15px] leading-relaxed">{d.wins.text}</p>
                <p className="mt-3 border-t border-dotted border-border pt-2.5 font-mono text-[11px] text-muted-foreground">
                  Source: {d.wins.source}
                </p>
              </div>
              <div className="border-b border-rule p-6">
                <p className="label-caps mb-2.5">What you're bringing in</p>
                <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed">
                  {d.assets.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              <div className="border-b border-rule p-6 md:border-b-0 md:border-r">
                <p className="label-caps mb-2.5 text-critical">The risk</p>
                <p className="text-[15px] leading-relaxed">{d.risk}</p>
              </div>
              <div className="p-6">
                <p className="label-caps mb-2.5 text-stable">The move</p>
                <p className="text-[15px] leading-relaxed">{d.move}</p>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ---- mindset ---- */}
      <section className="mx-auto max-w-[88rem] px-5 pt-20 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Running all four without breaking</h2>
          <span className="label-caps">From SONAR's own Playbook</span>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-2">
          {RULES.map((r, i) => (
            <div key={r.title} className="bg-paper p-6">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-wider",
                    r.evidence === "ours" ? "text-stable" : "text-muted-foreground",
                  )}
                >
                  {r.evidence}
                </span>
              </div>
              <h4 className="mt-2 font-display text-base font-bold">{r.title}</h4>
              <p className="mt-1.5 text-sm text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- checklist ---- */}
      <section className="mx-auto max-w-[88rem] px-5 pb-24 pt-16 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Close these before Saturday</h2>
          <span className="label-caps">{CHECKLIST.length} open items</span>
        </div>
        <div className="mt-6 divide-y divide-rule border border-border">
          {CHECKLIST.map((c) => (
            <div
              key={c.title}
              className="flex flex-wrap items-center gap-4 bg-paper px-6 py-4 sm:flex-nowrap"
            >
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  c.severity === "critical" ? "bg-critical" : "bg-warning",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.title}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{c.note}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap font-mono text-xs tabular-nums",
                  c.severity === "critical" ? "text-critical" : "text-warning",
                )}
              >
                {c.due}
              </span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
