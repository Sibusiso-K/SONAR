import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Reveal, RevealWords } from "@/components/Reveal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/war-room")({
  head: () => ({
    meta: [
      { title: "War Room: Mintek Top 5 | SONAR" },
      {
        name: "description",
        content:
          "Mintek named the team in its Top 5. What happens before winners are announced, what else is open this month, and the results so far.",
      },
      { property: "og:title", content: "War Room: Mintek Top 5 | SONAR" },
      {
        property: "og:description",
        content:
          "Top 5 at Mintek, with the originality check and IP assessment still to come. An honest scoreboard for everything decided.",
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

type ResultRow = {
  name: string;
  when: string;
  result: string;
  tone: "win" | "loss";
  note: string;
};

const RESULTS: ResultRow[] = [
  {
    name: "IBM Dev Day: Bob in Action",
    when: "28–30 Aug",
    result: "3rd place",
    tone: "win",
    note: "Confirmed by official email 28 Sept. BobSwarm, a Bob 2.0 multi-agent orchestrator.",
  },
  {
    name: "Entelect Hack<IT> Community Cup",
    when: "12 Sep",
    result: "Did not place",
    tone: "loss",
    note: "Entered solo, leaderboard-scored.",
  },
  {
    name: "SITA GovTech 2026",
    when: "17–20 Sep",
    result: "Did not place",
    tone: "loss",
    note: "PILOT CORE, remote participation.",
  },
  {
    name: "Geekulcha #GKHack26",
    when: "25–27 Sep",
    result: "Did not place",
    tone: "loss",
    note: "V.U.K.A., not selected into the top 12.",
  },
  {
    name: "UNESCO Youth Hackathon",
    when: "Aug submission",
    result: "Did not place",
    tone: "loss",
    note: "Concept submission; reported 4 Oct.",
  },
  {
    name: "Mintek-SCi Grad Hackathon",
    when: "1–2 Oct",
    result: "Top 5 finalist",
    tone: "win",
    note: "KHANYA. Not decided: winners follow authentication and an IP assessment.",
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
    name: "Mintek-SCi Grad Hackathon",
    tagline: "Top 5 finalist · winners TBA",
    meta: "Prize: R25k / R15k / R10k across the top 3 · Project: KHANYA (REEFPRINT workbench)",
    when: "DONE: 1 OCT build day, 2 OCT conference. NEXT: originality check, MOTT IP assessment, winners (no date published)",
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
    risk: "Finalists go through originality and AI-generation authentication, then Mintek's technology-transfer office (MOTT) runs an IP assessment on the top-ranked entries before winners are named. Two things in the repo's own record could trip that: commits carry a UNISA email while the documents say Wits, and commits are co-authored by an AI assistant while invention credits are awarded per person (KHANYA WORKBOARD item D6; HANDOVER on authorship). Separately, per-class recall and the abstention behaviour are commitments in the abstract; show the evidence, not the claim, if asked.",
    move: "Reconcile the commit email and authorship position before authentication starts, and keep the repo exactly as submitted. Finish the technical report on Mintek's template (12-page cap) if it is still required; its due date is not recorded anywhere checked, so ask Mintek. Keep writing in your own words and cite sources. Add the winners date to the calendar the moment Mintek sends it.",
  },
];

const RULES: { evidence: "ours" | "external"; title: string; body: string }[] = [
  {
    evidence: "ours",
    title: "The decisions that matter happen before kickoff",
    body: "Every task below is due before its event, not during it.",
  },
  {
    evidence: "external",
    title: "Arrive with the scaffold built",
    body: "Teams that skip a tested deploy pipeline and a rehearsed demo flow lose the first hours to setup instead of building the thing judges actually see.",
  },
  {
    evidence: "external",
    title: "Judged rooms are decided in 30 seconds",
    body: "Judges see dozens of demos and form an opinion almost immediately. Open with the problem, named around one specific person — not with the tech stack.",
  },
  {
    evidence: "ours",
    title: "A pattern worth naming: builds that work, pitches that don't place",
    body: "Entelect, GovTech and Geekulcha all produced real, working builds and none placed; Mintek is the first to get through. Spend ten minutes on what was different about how it was framed, and reuse that shape for YouthX, FNB and BCG.",
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
    title: "Nedbank YouthX entry: confirm eligibility, then submit",
    note: "R675k across ten places. Individual entries, age 18-26, qualifying Nedbank account; no closing time stated, so submit by midday",
    due: "Fri 9 Oct",
  },
  {
    severity: "warning",
    title: "Mintek: reconcile commit email and authorship before authentication",
    note: "UNISA email on commits vs Wits in the documents; AI co-authorship vs per-person invention credits",
    due: "Before Mintek's check",
  },
  {
    severity: "warning",
    title: "IBM TechXchange: decide on the conference pass",
    note: "3rd place is inside the top 50, which earns a pass per member; travel and lodging are not covered. Atlanta, 26-29 Oct",
    due: "This week",
  },
  {
    severity: "warning",
    title: "RSNA Knee: confirm the team is entered and decide on a merger",
    note: "Entry and merger deadline 15 Oct, final 22 Oct; field is 5,112 teams, so the efficiency track is the realistic angle",
    due: "Thu 15 Oct",
  },
  {
    severity: "warning",
    title: "BCG Platinion: no selection notice on record",
    note: "Event is 16-17 Oct, both days mandatory, and clashes with the IBM Z Datathon and the Legacy Project Symposium",
    due: "Before 16 Oct",
  },
];

/* ---------------- page ---------------- */

function WarRoom() {
  return (
    <AppShell>
      <section className="mx-auto max-w-[88rem] px-5 pb-12 pt-16 md:px-10 md:pt-24">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <p className="label-caps">War room</p>
          <p className="label-caps tabular-nums">Updated 5 Oct 2026</p>
        </div>
        <h1 className="display-xl mt-5 max-w-[16ch]">
          <RevealWords text="Top 5 at Mintek. Now the check that decides it." />
        </h1>
        <Reveal delay={200}>
          <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Mintek named the team one of its five finalists. Entelect, GovTech, Geekulcha and UNESCO
            did not place, and IBM's Dev Day hackathon came back a confirmed 3rd.{" "}
            <strong className="font-semibold text-foreground">
              Before winners are announced, finalists face an originality check and an IP
              assessment.
            </strong>{" "}
            What that means for the team, what is still open this month, and an honest scoreboard
            for everything decided so far.
          </p>
        </Reveal>
      </section>

      {/* ---- results so far ---- */}
      <section className="mx-auto max-w-[88rem] px-5 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Results so far</h2>
          <span className="label-caps">{RESULTS.length} entries</span>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {RESULTS.map((r) => (
            <div key={r.name} className="bg-paper p-5">
              <p className="font-mono text-xs font-semibold tabular-nums text-accent">
                {r.when.toUpperCase()}
              </p>
              <p className="mt-1.5 font-display text-base font-bold leading-tight">{r.name}</p>
              <span
                className={cn(
                  "mt-3 inline-block border px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
                  r.tone === "win"
                    ? "border-stable text-stable"
                    : "border-border text-muted-foreground",
                )}
              >
                {r.result}
              </span>
              <p className="mt-2.5 text-[13px] text-muted-foreground">{r.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- needs attention ---- */}
      <section className="mx-auto max-w-[88rem] px-5 pt-16 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Needs attention this week</h2>
          <span className="label-caps">{NEEDS_ATTENTION.length} open items</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Internal preparation targets, not organiser-issued deadlines. All times SAST
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

      {/* ---- dossier ---- */}
      {DOSSIERS.map((d) => (
        <section key={d.n} className="mx-auto max-w-[88rem] scroll-mt-24 px-5 pt-16 md:px-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-2xl font-bold">{d.name}</h2>
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
      <section className="mx-auto max-w-[88rem] px-5 pt-16 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">What to carry forward</h2>
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
