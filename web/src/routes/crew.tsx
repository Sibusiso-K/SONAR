import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { openDebrief } from "@/components/DebriefPrompt";
import { QueryError } from "@/components/QueryError";
import { formatDay } from "@/lib/assistant.builtin";
import { CREW_PROFILES, type CrewProfile } from "@/lib/crew";
import { OUTCOME_LABEL, awaitingDebrief, type Debrief } from "@/lib/debrief";
import { CREW, useIdentity, type CrewMember } from "@/lib/identity";
import { useDebriefs, useOpportunities, usePastOpportunities } from "@/lib/sonar-data";
import { safeHref } from "@/lib/safe-url";
import type { PastOpportunity } from "@/lib/sonar-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/crew")({
  validateSearch: z.object({ who: z.enum(CREW).optional() }),
  head: () => ({
    meta: [
      { title: "Crew: who owns what, and how it went | SONAR" },
      {
        name: "description",
        content:
          "The two people behind the board: what each owns, the team's record, and the debriefs filed after each event.",
      },
    ],
  }),
  component: Crew,
});

const GOOD = new Set(["won", "placed"]);

function Crew() {
  const { who } = Route.useSearch();
  const { identity } = useIdentity();
  const active: CrewMember = who ?? identity ?? "Sibusiso";
  const profile = CREW_PROFILES[active];

  const pastQuery = usePastOpportunities();
  const { data: live = [] } = useOpportunities();
  const { data: debriefs } = useDebriefs();
  const past = pastQuery.data ?? [];

  const mine = (debriefs?.rows ?? []).filter((d) => d.filed_by === active);
  const waiting = awaitingDebrief(live, new Date(), new Set(mine.map((d) => d.opportunity_id)));
  const entered = past.filter((p) => p.outcome !== "missed");
  const placed = past.filter((p) => GOOD.has(p.outcome));
  const bench = profile.voice === "bench";

  return (
    <AppShell>
      <div className="mx-auto flex max-w-[78rem] flex-col gap-5 px-4 pt-4 md:px-6 md:pt-6">
        <div
          role="tablist"
          aria-label="Crew"
          className="glass-card rise ml-auto flex gap-1 rounded-full p-1"
        >
          {CREW.map((name) => (
            <Link
              key={name}
              to="/crew"
              search={{ who: name }}
              role="tab"
              aria-selected={name === active}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-full py-1 pl-1.5 pr-5 text-sm font-semibold transition-colors",
                name === active ? "bg-paper shadow-sm" : "text-muted-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-8 place-items-center rounded-full font-mono text-[11px]",
                  name === "Sibusiso"
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-accent-foreground",
                )}
              >
                {CREW_PROFILES[name].initials}
              </span>
              {name}
            </Link>
          ))}
        </div>

        {/* key: remount on switch so the panels rise again */}
        <div key={active} role="tabpanel" aria-label={active} className="flex flex-col gap-5">
          <Hero profile={profile} entered={entered.length} placed={placed} />

          {pastQuery.isError && (
            <QueryError error={pastQuery.error} onRetry={() => pastQuery.refetch()} />
          )}

          <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <section
              aria-label={`What ${active} owns`}
              className="glass-card rise p-6"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              <h2 className={bench ? "label-caps" : "text-lg font-semibold"}>Owns by default</h2>
              {bench ? (
                <ol className="mt-3 font-mono text-[13px]">
                  {profile.owns.map((line, i) => (
                    <li
                      key={line}
                      className="flex gap-4 border-t border-border py-2.5 last:border-b"
                    >
                      <span className="text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {line}
                    </li>
                  ))}
                </ol>
              ) : (
                <ul className="mt-4 flex flex-wrap gap-2.5">
                  {profile.owns.map((line) => (
                    <li key={line} className="pill bg-accent/15 font-medium">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                The default split in docs/TEAM.md. Swapped deliberately, per event.
              </p>
            </section>

            <Record past={past} bench={bench} />
          </div>

          <Evaluation
            who={active}
            debriefs={mine}
            waiting={waiting.map((w) => ({ id: w.o.id, name: w.o.name, daysAgo: w.daysAgo }))}
            canFile={identity === active}
            onDevice={debriefs ? !debriefs.fromDatabase : false}
          />
        </div>
      </div>
    </AppShell>
  );
}

function Hero({
  profile,
  entered,
  placed,
}: {
  profile: CrewProfile;
  entered: number;
  placed: PastOpportunity[];
}) {
  const bench = profile.voice === "bench";
  const best = placed.map((p) => p.placement).find(Boolean);
  const stats: [string, string][] = [
    ["Team entries", String(entered)],
    ["Placed", String(placed.length)],
    ["Best", best ?? "none yet"],
  ];
  return (
    <section
      className={cn(
        "rise flex flex-wrap items-end justify-between gap-6 rounded-[1.75rem] p-7 md:p-8",
        bench ? "ink-panel" : "bg-accent/15",
      )}
    >
      <div className="min-w-0">
        <p
          className={bench ? "label-caps" : "text-sm text-accent"}
          style={bench ? { color: "var(--ink-panel-muted)" } : undefined}
        >
          {bench ? `crew/${profile.id.toLowerCase()} · ${profile.strap}` : profile.strap}
        </p>
        <h1
          className={cn(
            "mt-2 text-4xl md:text-6xl",
            bench ? "font-extrabold tracking-[-0.045em]" : "font-bold",
          )}
        >
          {profile.fullName}
        </h1>
        {profile.headline && (
          <p className={cn("mt-3 max-w-xl", bench ? "font-mono text-sm opacity-80" : "text-lg")}>
            {profile.headline}
          </p>
        )}
        <p className="mt-4 flex flex-wrap gap-2">
          {profile.links.map((l) => {
            const href = safeHref(l.href);
            return href ? (
              <a
                key={l.label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "pill border",
                  bench ? "border-white/25" : "border-accent/40 text-foreground",
                )}
              >
                {l.label}
              </a>
            ) : null;
          })}
        </p>
      </div>
      <dl className="grid grid-cols-3">
        {stats.map(([k, v]) => (
          <div
            key={k}
            className={cn("border-l px-4", bench ? "border-white/20" : "border-accent/30")}
          >
            <dt
              className="label-caps"
              style={bench ? { color: "var(--ink-panel-muted)" } : undefined}
            >
              {k}
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold md:text-3xl">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Record({ past, bench }: { past: PastOpportunity[]; bench: boolean }) {
  const rows = [...past].sort((a, b) => (b.happened_on ?? "").localeCompare(a.happened_on ?? ""));
  return (
    <section
      aria-label="Team record"
      className="glass-card rise min-w-0 p-6"
      style={{ "--i": 2 } as React.CSSProperties}
    >
      <h2 className={bench ? "label-caps" : "text-lg font-semibold"}>Team record</h2>
      {rows.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No finished entries on record yet.</p>
      )}
      <ul className={cn("mt-3", bench && "font-mono text-[13px]")}>
        {rows.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 border-t border-border py-2.5"
          >
            <span className="w-24 shrink-0 text-muted-foreground">
              {p.happened_on ? formatDay(p.happened_on) : "date unknown"}
            </span>
            <span className="min-w-0 flex-1 basis-40">{p.name}</span>
            <span
              className="font-medium"
              style={{ color: GOOD.has(p.outcome) ? "var(--stable)" : "var(--muted-foreground)" }}
            >
              {p.placement || p.outcome}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Entries are recorded for the team, not per person, so both tabs show the same record.
      </p>
    </section>
  );
}

function Evaluation({
  who,
  debriefs,
  waiting,
  canFile,
  onDevice,
}: {
  who: CrewMember;
  debriefs: Debrief[];
  waiting: { id: string; name: string; daysAgo: number }[];
  canFile: boolean;
  onDevice: boolean;
}) {
  return (
    <section
      id="evaluation"
      aria-label={`${who}'s evaluation`}
      className="glass-card rise flex flex-col gap-4 p-6"
      style={{ "--i": 3 } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          Evaluation{" "}
          <span className="text-[13px] font-normal text-muted-foreground">
            filled from debriefs
          </span>
        </h2>
        {waiting.length > 0 && (
          <span className="font-mono text-xs" style={{ color: "var(--warning)" }}>
            {waiting.length} waiting
          </span>
        )}
      </div>

      {waiting.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {waiting.map((w) => (
            <button
              key={w.id}
              type="button"
              disabled={!canFile}
              onClick={() => openDebrief(w.id)}
              className="rounded-2xl border p-4 text-left transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-70"
              style={{
                borderColor: "color-mix(in oklab, var(--warning) 45%, transparent)",
                backgroundColor: "color-mix(in oklab, var(--warning) 12%, transparent)",
              }}
            >
              <span className="label-caps">
                finished {w.daysAgo === 1 ? "yesterday" : `${w.daysAgo} days ago`} · debrief due
              </span>
              <span className="mt-1.5 block text-sm font-semibold">{w.name}</span>
              <span className="mt-1 block text-[13px] text-muted-foreground">
                {canFile
                  ? "How did it go? Two minutes."
                  : `Pick "${who}" in the sidebar to file this one.`}
              </span>
            </button>
          ))}
        </div>
      )}

      {debriefs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No debriefs filed yet. When an event's dates have passed, the board asks how it went and
          the answer lands here.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {debriefs.map((d) => (
            <article key={d.id} className="rounded-2xl border border-border bg-paper p-4">
              <p className="label-caps">
                {formatDay(d.created_at)} · {OUTCOME_LABEL[d.outcome] ?? d.outcome}
                {d.placement ? ` · ${d.placement}` : ""}
              </p>
              <h3 className="mt-1.5 text-base font-semibold">{d.opportunity_name}</h3>
              <dl className="mt-2 space-y-1.5 text-[13px]">
                {(
                  [
                    ["Hours", d.hours_spent != null ? String(d.hours_spent) : null],
                    ["Worked", d.what_worked],
                    ["Cost us", d.what_cost_us],
                    ["Reuse", d.would_reuse?.length ? d.would_reuse.join(" · ") : null],
                    ["Judges", d.judge_feedback ? `"${d.judge_feedback}"` : null],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-3">
                      <dt className="w-16 shrink-0 text-muted-foreground">{k}</dt>
                      <dd className="min-w-0">{v}</dd>
                    </div>
                  ))}
              </dl>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                sorted by {d.structured_by.replace(/^[^/]+\//, "").replace(/:free$/, "")}
              </p>
            </article>
          ))}
        </div>
      )}

      {onDevice && (
        <p className="text-xs text-muted-foreground">
          Showing only debriefs kept in this browser: the database's debriefs table could not be
          read.
        </p>
      )}
    </section>
  );
}
