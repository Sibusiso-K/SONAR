import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Reveal, RevealWords } from "@/components/Reveal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/war-room")({
  head: () => ({
    meta: [
      { title: "War Room: three weekends, one team | SONAR" },
      {
        name: "description",
        content:
          "GovTech, Geekulcha and Mintek, back to back over three weekends: what each judged panel actually rewards, what we're bringing in, and what still needs closing before each one.",
      },
      { property: "og:title", content: "War Room: three weekends, one team | SONAR" },
      {
        property: "og:description",
        content:
          "All three are judged pitches, not leaderboards. The event-by-event prep plan for winning them.",
      },
    ],
  }),
  component: WarRoom,
});

/* ---------------- data ---------------- */

type TimelineEntry = {
  day: string;
  name: string;
  venue: string;
  who: string;
  flag?: string;
};

const TIMELINE: TimelineEntry[] = [
  {
    day: "Thu 17 – Sun 20 Sep",
    name: "GovTech 2026",
    venue: "Remote / online",
    who: "PILOT CORE",
  },
  {
    day: "Fri 25 – Sun 27 Sep",
    name: "Geekulcha #GKHack26",
    venue: "BCX HQs, Centurion",
    who: "Team SONAR",
  },
  {
    day: "Thu 1 – Fri 2 Oct",
    name: "Mintek-SCi",
    venue: "Randburg · build to 13:00",
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
  wins: { text: string; source: string };
  assets: string[];
  risk: string;
  move: string;
};

const DOSSIERS: Dossier[] = [
  {
    n: 1,
    name: "SITA GovTech 2026",
    tagline: "Remote · selected",
    meta: "Entity: PILOT CORE (PTY) LTD · Team: Sibusiso, Lethabo, Ipeleng",
    when: "THU 17 – SUN 20 SEP · REMOTE (was in-person Durban ICC, changed 11 Sept)",
    what: "A public-sector problem you won't see until day one",
    wins: {
      text: "SITA shares its adjudication criteria on the first morning, not before — so this isn't a build-the-right-thing-in-advance event. What's public: winning solutions have to show clear engagement with a real, current South African socio-economic problem, not a generic tech demo retrofitted to a government theme.",
      source: "SITA GovTech public judging notes; T&Cs read 17 Aug",
    },
    assets: [
      "Three-person, EME-registered entity already cleared on eligibility",
      "Now remote — no travel/accommodation cost, but the team must actively guard against split attention across three locations",
      "Nearly three weeks between selection (9 Sept) and event start — more runway than any other event on the board to lock a day-one workflow in advance",
    ],
    risk: "The reply confirming attendance was due 11 Sept — already overdue as of 13 Sept, with no confirmation on record that it was sent. IP terms are also worth a five-minute re-read: SITA takes an irrevocable worldwide licence over Hackathon Outputs, and pre-existing background IP only stays yours if it's flagged before or at time of use.",
    move: "Confirm today whether the reply actually went out, and send it now if not — a missed RSVP after selection is the one failure mode no amount of prep fixes. Agree the remote-logistics plan (one shared call running the whole weekend, one person owning the demo narrative) before the 17th, not on the day. On day one, don't start coding until someone has written the one-sentence version of the problem and named the specific person it helps — that's the sentence the demo opens with on day four.",
  },
  {
    n: 2,
    name: "Geekulcha #GKHack26",
    tagline: "BCX HQs Centurion · selected, physical",
    meta: "Docs: 9 of 9 submitted · Sponsors: Telkom · CPSI · Red Bull",
    when: "FRI 25, 16:00 – SUN 27, 15:00",
    what: "V.U.K.A. — Blockchain for Impact, out of 394 teams",
    wins: {
      text: "Geekulcha's own theme framing (2025: “Harnessing Intelligence for Sustainable Development”) rewards solutions judges can call technically viable, ethically sound and socially inclusive in one breath — not the most technically ambitious build in the room. With up to 50 solutions and six judging rooms in past years, a judge spends minutes with you, not hours.",
      source: "Geekulcha public event pages, prior editions",
    },
    assets: [
      "Every required document already filed: pitch deck, gap analysis, SLDC, full system architecture",
      "A direct steer from the organiser's own selection email, which is rare and worth following literally",
    ],
    risk: "The selection email names three specific gaps: V.U.K.A. currently reads as more AI-driven than consumer-facing, has no work breakdown structure yet, and needs to reach Technology Readiness Level 4 before the 25th. Treat it as the actual brief, since it came from the people scoring you.",
    move: "Before build weekend: rewrite the one-line pitch so a non-technical judge hears “what this does for someone,” not “what model it runs.” Produce the WBS. Push the prototype to TRL 4. All three are homework, not hackathon-weekend work — start this week, not the week of the 25th.",
  },
  {
    n: 3,
    name: "Mintek-SCi Grad Hackathon",
    tagline: "Randburg · R50,000 pool",
    meta: "Prize: R25k / R15k / R10k · Next: SCI Conference, 2 Oct",
    when: "THU 1 OCT · build to 13:00, present 14:00",
    what: "REEFPRINT — mineralogical characterisation by optical proxy",
    wins: {
      text: "2025's winner, H2Optimise (UJ), paired real mining-engineering domain knowledge with a data-driven model on a genuine operational problem — mine-water reprocessing, framed in cost and sustainability terms an industry judge already cares about. Judging runs on innovation, feasibility, impact, technical execution and presentation clarity, in that order of what actually differentiates entries.",
      source: "Mintek-SCi 2025 results (UJ News); Mintek's own judging criteria",
    },
    assets: [
      "Already the sharpest domain framing on the board: five named Bushveld phases, sub-1% base-metal-sulphide recall reported honestly rather than buried in an aggregate number",
      "Costs already in Rand and tCO2e against real gazetted Eskom/carbon-tax rates — exactly the register H2Optimise won on",
      "Positioned as a StarCS/FloatStar/MillStar module, not a rip-and-replace pitch to an industry that hates those",
    ],
    risk: "This is the third weekend in three weeks and the only one with a hard same-day code freeze at 13:00 followed by presenting at 14:00 — zero recovery time if the team is running on fumes by 1 October. An MOTT IP assessment follows before any result is final.",
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
    body: "Teams that skip a tested deploy pipeline and a rehearsed demo flow lose the first hours to setup instead of building the thing judges actually see.",
  },
  {
    evidence: "external",
    title: "Judged rooms are decided in 30 seconds",
    body: "For GovTech, Geekulcha and Mintek: judges see dozens of demos and form an opinion almost immediately. Open with the problem, named around one specific person — not with the tech stack.",
  },
  {
    evidence: "ours",
    title: "Judges remember the story, not the stack",
    body: "A technically weaker team with a sharper, rehearsed pitch beats a stronger build with no narrative, every time in a panel-scored room. Rehearse the pitch out loud at least once before each event — not just the demo.",
  },
];

type CheckItem = { severity: "critical" | "warning"; title: string; note: string; due: string };

const CHECKLIST: CheckItem[] = [
  {
    severity: "critical",
    title: "Confirm the SITA attendance reply actually went out",
    note: "Deadline was 11 Sep — already overdue, and not confirmed sent",
    due: "Overdue",
  },
  {
    severity: "warning",
    title: "Push V.U.K.A. to TRL 4 + write the WBS",
    note: "Named directly in Geekulcha's own selection email",
    due: "By 25 Sep",
  },
  {
    severity: "warning",
    title: "Lock the GovTech remote-logistics plan",
    note: "One shared call for the whole weekend, one person owning the demo narrative",
    due: "By 17 Sep",
  },
  {
    severity: "warning",
    title: "Rehearse the Mintek presentation out loud",
    note: "10 minutes, once, before the day — protect sleep before this slot specifically",
    due: "By 1 Oct",
  },
];

/* ---------------- page ---------------- */

function WarRoom() {
  return (
    <AppShell>
      <section className="mx-auto max-w-[88rem] px-5 pb-12 pt-16 md:px-10 md:pt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <p className="label-caps">War room</p>
          <p className="label-caps tabular-nums">17 Sep – 2 Oct 2026</p>
        </div>
        <h1 className="display-xl mt-5 max-w-[16ch]">
          <RevealWords text="Three hackathons. Two and a half weeks. One team of three." />
        </h1>
        <Reveal delay={200}>
          <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
            GovTech, Geekulcha and Mintek land back to back, starting next Thursday.{" "}
            <strong className="font-semibold text-foreground">
              All three are judged pitches, not leaderboards.
            </strong>{" "}
            A human panel scores narrative, feasibility and how well you present — a technically
            weaker team with a sharper pitch beats you every time. What each event actually rewards,
            what we're bringing into it, and what still needs closing before each one starts.
          </p>
        </Reveal>
      </section>

      {/* ---- timeline ---- */}
      <section className="mx-auto max-w-[88rem] px-5 md:px-10">
        <div className="overflow-x-auto">
          <div className="grid min-w-[36rem] grid-cols-3 gap-px bg-rule border border-rule">
            {TIMELINE.map((t) => (
              <div key={t.name} className="bg-paper p-5">
                <p className="font-mono text-xs font-semibold tabular-nums text-accent">
                  {t.day.toUpperCase()}
                </p>
                <p className="mt-1.5 font-display text-base font-bold leading-tight">{t.name}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{t.venue}</p>
                <span className="mt-3 inline-block border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Judged · {t.who}
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
          <p className="label-caps text-accent">The one thing to internalise before Thursday</p>
          <p className="mt-2.5 max-w-3xl text-[15px] leading-relaxed">
            <strong className="font-semibold">GovTech, Geekulcha and Mintek</strong> are all the
            same game: a human panel scores narrative, feasibility and how well you present, and a
            technically weaker team with a sharper pitch beats you every time. Walking into any of
            these three with a heads-down-building, no-rehearsed-demo mindset is the single most
            avoidable way to lose all of them.
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
              <span className="h-fit whitespace-nowrap border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Judged arena
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
          <h2 className="font-display text-2xl font-bold">Running all three without breaking</h2>
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
          <h2 className="font-display text-2xl font-bold">Close these before Thursday</h2>
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
