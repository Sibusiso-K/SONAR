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

/* ---------------- data ----------------
 * This page is hardcoded briefing/strategy content, not a live readiness
 * tracker - see docs/REVIEW_2026-09-14.md, finding 5, and
 * docs/IMPROVEMENT_PLAN.md for why a real per-item evidence/owner model is
 * a separate, larger change than fixing the copy below is. Everything here
 * states what is actually known and links to primary sources rather than
 * summarising them, per the same review's findings 4 and 10. */

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
      text: "SITA's own terms say the judging criteria arrive on day one, not before — so this isn't a build-the-right-thing-in-advance event. What's public: winning solutions have to show clear engagement with a real, current South African socio-economic problem, not a generic tech demo retrofitted to a government theme. This board has not independently confirmed the criteria release timing beyond what the terms state.",
      source: "SITA GovTech public judging notes; official terms read 17 Aug",
    },
    assets: [
      "Three-person, EME-registered entity already cleared on eligibility",
      "Now remote — no travel/accommodation cost, but the team must actively guard against split attention across three locations",
      "The shortest prep runway of the three events, not the longest: 8 days between selection (9 Sept) and kickoff (17 Sept), versus 3+ weeks for Geekulcha and Mintek — the reason to lock the day-one workflow down first, not last",
    ],
    risk: "RSVP: the reply confirming attendance was due 11 Sept. That deadline has passed with no confirmation on record that a reply was sent — evidence missing, not proof it wasn't sent. Output ownership: the terms go beyond a licence — clause 4.2.1 assigns rights in Hackathon Outputs to SITA, with Background IP and incorporation-licence provisions in clauses 4.2.2–4.2.3; read all three before deciding what existing code to bring. Schedule: the public terms PDF still lists 17–19 September and allows online attendance; the team's later selection email extends it to 17–20 September. Treat 17–20 as the recorded instruction and get the discrepancy reconciled in writing rather than assuming either source is stale.",
    move: "Confirm today whether the RSVP reply actually went out, and send it now if not — a missed RSVP after selection is the one failure mode no amount of prep fixes. Get the 17–19 vs 17–20 date discrepancy answered in writing. Read clauses 4.2.1–4.2.5 and list any pre-existing component the team might reuse before the event starts, so it can be flagged as required. Agree the remote-logistics plan (one shared call running the whole weekend, one person owning the demo narrative) before the 17th. On day one, don't start coding until someone has written the one-sentence version of the problem and named the specific person it helps.",
  },
  {
    n: 2,
    name: "Geekulcha #GKHack26",
    tagline: "BCX HQs Centurion · selected, physical",
    meta: "Docs: 9 of 9 submitted · Sponsors: Telkom · CPSI · Red Bull",
    when: "FRI 25, 16:00 – SUN 27, 15:00",
    what: "V.U.K.A. — Blockchain for Impact (recorded track; confirm against the current brief)",
    wins: {
      text: "The current organiser brief for 2026 is Build for Use: usability, an identified user and validated problem, security, sustainability and measurable impact — not the 2025 theme this page previously reasoned from. Its public subtheme list differs from the Blockchain for Impact track recorded here; confirm which track V.U.K.A. is actually entered under rather than assuming the recorded one still applies. The selection email's separate request — consumer-facing framing, a WBS, TRL 4 — stands regardless of which subtheme is confirmed.",
      source: "Official Geekulcha 2026 event page, checked 14 Sept",
    },
    assets: [
      "Every required document already filed: pitch deck, gap analysis, SLDC, full system architecture",
      "A direct steer from the organiser's own selection email, which is rare and worth following literally",
    ],
    risk: "The selection email names three specific gaps: V.U.K.A. currently reads as more AI-driven than consumer-facing, has no work breakdown structure yet, and needs to reach Technology Readiness Level 4 before the 25th. None of those three are done as of this page — submitted documents establish that a plan exists, not that the prototype or its TRL4 evidence do.",
    move: "Confirm the current track against the Build for Use brief before finalising the pitch. Rewrite the one-line pitch so a non-technical judge hears “what this does for someone,” not “what model it runs.” Produce the WBS. Push the prototype to TRL 4 and keep the evidence (test procedure, environment, results) that shows it, not just the claim. All of this is homework, not hackathon-weekend work.",
  },
  {
    n: 3,
    name: "Mintek-SCi Grad Hackathon",
    tagline: "Randburg · R50,000 pool",
    meta: "Prize: R25k / R15k / R10k · Next: SCI Conference, 2 Oct",
    when: "THU 1 OCT · build to 13:00, present 14:00",
    what: "REEFPRINT — mineralogical characterisation by optical proxy",
    wins: {
      text: "2025's winner, H2Optimise (UJ), paired real mining-engineering domain knowledge with a data-driven model on a genuine operational problem — mine-water reprocessing, framed in cost and sustainability terms an industry judge already cares about. Mintek's published criteria include innovation, feasibility, impact, technical execution and presentation clarity; this board has not verified their relative weighting, so treat all five as capable of deciding the result rather than assuming one dominates.",
      source: "Mintek-SCi 2025 results (UJ News); Mintek's published judging criteria",
    },
    assets: [
      "Already the sharpest domain framing on the board: five named Bushveld phases and a stated sub-1% base-metal-sulphide class abundance — a description of how rare that class is in the data, not yet a measured recall score for it — named honestly rather than buried in an aggregate accuracy number",
      "Costs already in Rand and tCO2e against gazetted Eskom/carbon-tax rates — exactly the register H2Optimise won on, though current tariff/rate figures still need verifying before presenting them as numbers",
      "Positioned as a StarCS/FloatStar/MillStar module, not a rip-and-replace pitch to an industry that hates those — as a proposed interface, since no integration with those systems has been demonstrated",
    ],
    risk: "This is the third weekend in three weeks and the only one with a hard same-day code freeze at 13:00 followed by presenting at 14:00 — zero recovery time if the team is running on fumes by 1 October. An MOTT IP assessment follows before any result is final. Per-class recall (chromite, orthopyroxene, plagioclase, base-metal sulphide, talc/serpentine) and the abstention/calibration behaviour are commitments in the project abstract, not results demonstrated in this checkout — collect that evidence from the actual REEFPRINT project before the presentation, not during it.",
    move: "Protect this slot specifically: this is the highest-scoring entry on the whole board (7.95) and the one most explicitly aimed at your actual situation. Bank sleep before it, not after Geekulcha. Pull real per-class recall, sample support and a documented abstention example from the project before dress rehearsal. Rehearse the 10-minute presentation once, out loud, before the day arrives — confirm whether the ten minutes includes questions.",
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
    body: "This board's own working assumption, not a guaranteed law: a technically weaker team with a sharper, rehearsed pitch regularly beats a stronger build with no narrative in a panel-scored room. Rehearse the pitch out loud at least once before each event — not just the demo.",
  },
];

type ActionItem = {
  severity: "critical" | "warning";
  title: string;
  note: string;
  due: string;
};

const NEEDS_ATTENTION: ActionItem[] = [
  {
    severity: "critical",
    title: "Confirm the SITA attendance reply actually went out",
    note: "Deadline was 11 Sep — already overdue, and not confirmed sent. Evidence missing is not proof it wasn't sent",
    due: "Overdue since 11 Sep",
  },
  {
    severity: "critical",
    title: "Reconcile the GovTech roster's Lethabo surname",
    note: '"Lethabo Masilo Phukile" (GovTech record) vs "Lethabo Hoaeane" (Geekulcha platform) — resolve which is correct, don\'t merge without confirmation',
    due: "Before 17 Sep",
  },
  {
    severity: "warning",
    title: "Read GovTech's IP clauses and list reusable components",
    note: "Clause 4.2.1 assigns Hackathon Output rights to SITA; 4.2.2–4.2.3 cover Background IP and incorporation licensing",
    due: "Before 17 Sep",
  },
  {
    severity: "warning",
    title: "Lock the GovTech remote-logistics plan",
    note: "One shared call for the whole weekend, one person owning the demo narrative",
    due: "Before 17 Sep",
  },
  {
    severity: "warning",
    title: "Push V.U.K.A. to TRL 4 + write the WBS",
    note: 'Named directly in Geekulcha\'s own selection email; confirm the current "Build for Use" track first',
    due: "Before 25 Sep",
  },
  {
    severity: "warning",
    title: "Pull real per-class recall and an abstention example for REEFPRINT",
    note: "The abstract's rare-class and calibration claims are commitments, not yet demonstrated results",
    due: "Before 1 Oct",
  },
  {
    severity: "warning",
    title: "Rehearse the Mintek presentation out loud",
    note: "10 minutes, once, before the day — protect sleep before this slot specifically",
    due: "Before 1 Oct",
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
        <h1 className="display-xl mt-5 max-w-[20ch]">
          <RevealWords text="Three hackathons. Two and a half weeks. Every event has its own roster." />
        </h1>
        <Reveal delay={200}>
          <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
            GovTech, Geekulcha and Mintek land back to back, starting Thursday 17 September (SAST).{" "}
            <strong className="font-semibold text-foreground">
              All three are judged pitches, not leaderboards.
            </strong>{" "}
            A human panel scores narrative, feasibility and how well you present — this board treats
            a sharper, rehearsed pitch as more decisive than raw technical strength in that kind of
            room. What each event actually rewards, what we're bringing into it, and what still
            needs closing before each one starts. Read the individual event dossiers below for the
            primary sources behind each claim — this page summarises them, it isn't a substitute for
            reading the official terms.
          </p>
        </Reveal>
      </section>

      {/* ---- needs attention ---- */}
      <section className="mx-auto max-w-[88rem] px-5 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Needs attention first</h2>
          <span className="label-caps">{NEEDS_ATTENTION.length} open items</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Internal preparation targets, not organiser-issued deadlines. Nothing here is marked done
          from a plan alone — each needs its own evidence before it's closed. All times SAST
          (Africa/Johannesburg) unless noted.
        </p>
        <div className="mt-6 divide-y divide-rule border border-border">
          {NEEDS_ATTENTION.map((c) => (
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

      {/* ---- timeline ---- */}
      <section className="mx-auto max-w-[88rem] px-5 pt-16 md:px-10">
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
          <p className="label-caps text-accent">The one thing to internalise before 17 September</p>
          <p className="mt-2.5 max-w-3xl text-[15px] leading-relaxed">
            <strong className="font-semibold">GovTech, Geekulcha and Mintek</strong> are all the
            same game: a human panel scores narrative, feasibility and how well you present. Walking
            into any of these three with a heads-down-building, no-rehearsed-demo mindset is the
            most avoidable way to lose ground in all of them.
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

      {/* ---- sources ---- */}
      <section className="mx-auto max-w-[88rem] px-5 pt-16 md:px-10">
        <h2 className="font-display text-2xl font-bold">Primary sources</h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <a
              href="https://www.govtech.gov.za/wp-content/uploads/2026/07/GovTech-2026-Hackathon-Terms-and-Condition.pdf"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2 hover:opacity-80"
            >
              GovTech 2026 official terms and conditions (PDF)
            </a>{" "}
            <span className="text-muted-foreground">
              — checked 14 Sept; still lists 17–19 September and online attendance as an option
            </span>
          </li>
          <li>
            <a
              href="https://sonke.gklink.co/event/gkhack26"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2 hover:opacity-80"
            >
              Geekulcha #GKHack26 official event page
            </a>{" "}
            <span className="text-muted-foreground">
              — checked 14 Sept; current theme is "Build for Use"
            </span>
          </li>
        </ul>
      </section>

      {/* ---- mindset ---- */}
      <section className="mx-auto max-w-[88rem] px-5 pt-16 md:px-10">
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

      <div className="pb-24" />
    </AppShell>
  );
}
