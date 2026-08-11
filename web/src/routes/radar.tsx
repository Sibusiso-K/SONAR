import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { EventCalendar } from "@/components/EventCalendar";
import { OrgLogo } from "@/components/OrgLogo";
import { Reveal, RevealWords } from "@/components/Reveal";
import { useOpportunities, usePastOpportunities } from "@/lib/sonar-data";
import { formatMoney } from "@/lib/analytics";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/radar")({
  head: () => ({
    meta: [
      { title: "Radar — unverified entries and the archive | SONAR" },
      {
        name: "description",
        content:
          "Predicted and unverified opportunities that are not calendar-safe yet, plus an honest archive of what we entered, won and missed.",
      },
      { property: "og:title", content: "Radar — unverified entries and the archive | SONAR" },
      {
        property: "og:description",
        content:
          "Not calendar-safe yet: predicted windows, conflicted sources, and the past-and-missed log including corrections.",
      },
    ],
  }),
  component: Radar,
});

const OUTCOME_COLOR: Record<string, string> = {
  won: "var(--stable)",
  placed: "var(--stable)",
  entered: "var(--warning)",
  rejected: "var(--unknown)",
  missed: "var(--critical)",
};

function Radar() {
  const { data: all = [] } = useOpportunities();
  const { data: past = [] } = usePastOpportunities();

  const unverified = all.filter((o) =>
    ["predicted", "unconfirmed", "conflicted"].includes(o.confidence),
  );

  return (
    <AppShell>
      <section className="mx-auto max-w-[88rem] px-5 pb-12 pt-16 md:px-10 md:pt-24">
        <p className="label-caps">Radar</p>
        <h1 className="display-xl mt-5 max-w-[14ch]">
          <RevealWords text="Not calendar-safe. Not ignored either." />
        </h1>
        <Reveal delay={200}>
          <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground">
            Entries we believe exist but can't put in a calendar with a straight face. Kept visible
            so a predicted window doesn't quietly become a missed deadline.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[88rem] px-5 pb-12 md:px-10">
        <Reveal>
          <EventCalendar opportunities={all} />
        </Reveal>
      </section>

      <section className="mx-auto max-w-[88rem] px-5 md:px-10">
        <div className="grid gap-px bg-rule md:grid-cols-2 lg:grid-cols-3">
          {unverified.map((o, i) => (
            <Reveal key={o.id} delay={Math.min(i, 6) * 50}>
              <div className="h-full bg-paper p-6">
                <div className="flex items-center justify-between">
                  <span className="label-caps">{o.kind}</span>
                  <span
                    className="font-mono text-[10px] uppercase tracking-widest"
                    style={{
                      color: o.confidence === "conflicted" ? "var(--critical)" : "var(--warning)",
                    }}
                  >
                    {o.confidence}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2.5">
                  <OrgLogo organiser={o.organiser} size={24} />
                  <h3 className="text-xl font-bold">{o.name}</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{o.organiser}</p>
                <dl className="mt-4 space-y-2">
                  <div>
                    <dt className="label-caps">Expected window</dt>
                    <dd className="font-mono text-sm">
                      {o.dates?.["expected_window"] ?? "unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps">Prize (unverified)</dt>
                    <dd className="font-mono text-sm">
                      {formatMoney(o.prize?.pool, o.prize?.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps">Source</dt>
                    <dd className="font-mono text-sm">{o.source ?? "none"}</dd>
                  </div>
                </dl>
                {o.notes && (
                  <p className="mt-4 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
                    {o.notes}
                  </p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[88rem] px-5 pt-24 md:px-10">
        <p className="label-caps">Past &amp; missed</p>
        <h2 className="display-lg mt-4 max-w-[18ch]">The archive keeps the failures in.</h2>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          Including the entry we wrongly recorded as a miss for fifteen days.
        </p>

        <div className="mt-10">
          {past.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i, 6) * 40}>
              <div className="grid grid-cols-[3px_1fr] gap-x-5 border-b border-border py-6 md:grid-cols-[3px_9rem_1fr_auto] md:gap-x-8">
                <div
                  className="w-[3px]"
                  style={{ backgroundColor: OUTCOME_COLOR[p.outcome] ?? "var(--unknown)" }}
                  aria-hidden
                />
                <div className="font-mono text-sm tabular-nums text-muted-foreground">
                  {p.happened_on ?? "—"}
                </div>
                <div className="col-start-2 md:col-start-3">
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {p.organiser} · {p.kind}
                  </p>
                  {p.note && <p className="mt-2 max-w-2xl text-sm">{p.note}</p>}
                  {p.corrected && (
                    <p
                      className="mt-3 flex max-w-2xl gap-2 border-l-2 pl-3 text-sm text-muted-foreground"
                      style={{ borderColor: "var(--warning)" }}
                    >
                      <AlertTriangle
                        className="mt-0.5 size-4 shrink-0"
                        style={{ color: "var(--warning)" }}
                      />
                      <span>{p.correction_note}</span>
                    </p>
                  )}
                </div>
                <div className="col-start-2 mt-3 md:col-start-4 md:mt-0 md:text-right">
                  <div
                    className="font-display text-2xl font-bold"
                    style={{ color: OUTCOME_COLOR[p.outcome] ?? "var(--unknown)" }}
                  >
                    {p.placement || p.outcome}
                  </div>
                  {p.placement && <div className="label-caps">{p.outcome}</div>}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
