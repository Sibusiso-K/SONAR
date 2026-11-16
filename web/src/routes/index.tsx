import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { OpportunityRow } from "@/components/OpportunityRow";
import {
  ConfidenceArc,
  DeadlineField,
  NextUp,
  RadarCard,
  RecentUpdates,
  Totals,
} from "@/components/Overview";
import { Playbook } from "@/components/Playbook";
import { QueryError } from "@/components/QueryError";
import { Reveal } from "@/components/Reveal";
import { greeting, upcoming } from "@/lib/board-view";
import { useIdentity } from "@/lib/identity";
import { useOpportunities, usePastOpportunities, useUpdates, useWatchlist } from "@/lib/sonar-data";
import { BOARD_TZ, collisions, daysUntil, winProbability } from "@/lib/analytics";
import { LOCALE } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SONAR: opportunity board for two" },
      {
        name: "description",
        content:
          "Every live hackathon, competition and grad programme we're tracking, sorted by what closes first and what we can actually win.",
      },
      { property: "og:title", content: "SONAR: opportunity board for two" },
      {
        property: "og:description",
        content:
          "A shared, source-traced board of hackathons, competitions and grad programmes. Countdowns, win probability, expected value.",
      },
    ],
  }),
  component: Board,
});

type SortKey = "deadline" | "probability";

function Board() {
  const { data: opportunities = [], isLoading, isError, error, refetch } = useOpportunities();
  const { data: past = [] } = usePastOpportunities();
  const { data: updates = [] } = useUpdates();
  const { data: watchlist = [] } = useWatchlist();
  const { identity, hydrated } = useIdentity();
  const [sort, setSort] = useState<SortKey>("deadline");
  const [watchedOnly, setWatchedOnly] = useState(false);

  const live = useMemo(
    () => opportunities.filter((o) => o.confidence !== "predicted"),
    [opportunities],
  );

  const rows = useMemo(() => {
    const filtered = watchedOnly
      ? live.filter((o) => watchlist.some((w) => w.opportunity_id === o.id))
      : live;
    const sorted = [...filtered];
    if (sort === "deadline") {
      sorted.sort((a, b) => {
        const da = daysUntil(a.next_date);
        const db = daysUntil(b.next_date);
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
    } else {
      sorted.sort((a, b) => winProbability(b) - winProbability(a));
    }
    return sorted;
  }, [live, sort, watchedOnly, watchlist]);

  const clashes = collisions(live);
  const next = upcoming(live);
  const closing = next.filter((d) => d.days <= 21).length;
  const ready = !isError && !isLoading;

  return (
    <AppShell>
      <div className="mx-auto flex max-w-[88rem] flex-col gap-5 px-4 pt-4 md:px-6 md:pt-6">
        <header className="rise flex flex-wrap items-end justify-between gap-4">
          <div>
            {/* The name is only known after hydration; rendering it on the
                server would mismatch for whoever has not picked one. */}
            <h1 className="text-3xl font-bold md:text-4xl">
              {hydrated ? greeting() : "Good day"}
              {hydrated && identity ? `, ${identity}` : ""}
            </h1>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              {new Date().toLocaleDateString(LOCALE, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: BOARD_TZ,
              })}
            </p>
          </div>
          <p className="max-w-md text-sm text-muted-foreground" data-testid="board-summary">
            {/* A failed or pending read must not read as an empty board: "0 live
                entries" is a claim about the data, so it is only made once the
                data has actually arrived. */}
            {isError ? (
              "The board couldn't be read just now. That is not the same as an empty board."
            ) : isLoading ? (
              "Reading the board…"
            ) : (
              <>
                {live.length} live entries. {closing} close inside three weeks. Where a date is only
                reported, the row says so.
              </>
            )}
          </p>
        </header>

        {isError && <QueryError error={error} onRetry={() => refetch()} />}

        {ready && (
          <>
            <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
              <p className="mb-2 text-sm text-muted-foreground">Next up</p>
              <NextUp items={next.slice(0, 3)} undated={live.length - next.length} />
            </div>

            <section
              aria-label="Board at a glance"
              className="glass rise relative z-10 -mt-5 flex flex-col gap-5 p-4 md:p-5"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              <Totals live={live} past={past} />
              <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
                <DeadlineField live={live} />
                <div className="flex min-w-0 flex-col gap-4">
                  <div className="flex flex-wrap gap-4">
                    <ConfidenceArc live={live} />
                    <RadarCard live={live} />
                  </div>
                  <RecentUpdates updates={updates} />
                </div>
              </div>
            </section>
          </>
        )}

        {clashes.length > 0 && (
          <Reveal>
            <div
              className="glass-card border-l-4 p-5"
              style={{ borderLeftColor: "var(--critical)" }}
            >
              <p className="label-caps" style={{ color: "var(--critical)" }}>
                Collision warning
              </p>
              {clashes.map((c) => (
                <p key={c.weekStart} className="mt-2 text-base">
                  Week of <strong>{c.weekLabel}</strong>: {c.items.map((i) => i.name).join(" and ")}{" "}
                  land in the same week. Two committed entries, one weekend. Decide now rather than
                  on the Friday.
                </p>
              ))}
            </div>
          </Reveal>
        )}

        <section aria-label="Every live entry" className="pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-2xl font-bold">Every live entry</h2>
            {(
              [
                ["deadline", "Closest deadline"],
                ["probability", "Win probability"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                aria-pressed={sort === key}
                className={cn(
                  "pill",
                  sort === key ? "bg-primary text-primary-foreground" : "glass-card",
                )}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setWatchedOnly((v) => !v)}
              aria-pressed={watchedOnly}
              className={cn(
                "pill",
                watchedOnly ? "bg-accent text-accent-foreground" : "glass-card",
              )}
            >
              Watched only
            </button>
          </div>

          {!isError && isLoading && (
            <p className="py-16 text-sm text-muted-foreground">Loading the board…</p>
          )}

          {ready && rows.length === 0 && (
            <p className="py-16 text-sm text-muted-foreground">
              Nothing here. Either we've cleared the board or nobody starred anything.
            </p>
          )}

          {!isError && (
            <div className="mt-4 flex flex-col gap-3">
              {rows.map((o, i) => (
                <Reveal key={o.id} delay={Math.min(i, 6) * 40}>
                  <OpportunityRow
                    o={o}
                    index={i}
                    watchers={watchlist.filter((w) => w.opportunity_id === o.id)}
                  />
                </Reveal>
              ))}
            </div>
          )}
        </section>
      </div>

      {!isError && <Playbook />}
    </AppShell>
  );
}
