import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BoardRadar } from "@/components/BoardRadar";
import { OpportunityRow } from "@/components/OpportunityRow";
import { Reveal, RevealWords } from "@/components/Reveal";
import { useOpportunities, useWatchlist } from "@/lib/sonar-data";
import { collisions, daysUntil, winProbability } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SONAR — Opportunity board for two" },
      {
        name: "description",
        content:
          "Every live hackathon, competition and grad programme we're tracking, sorted by what closes first and what we can actually win.",
      },
      { property: "og:title", content: "SONAR — Opportunity board for two" },
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
  const { data: opportunities = [], isLoading } = useOpportunities();
  const { data: watchlist = [] } = useWatchlist();
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
  const closing = live.filter((o) => {
    const d = daysUntil(o.next_date);
    return d !== null && d >= 0 && d <= 21;
  }).length;

  return (
    <AppShell>
      <section className="mx-auto max-w-[88rem] px-5 pb-16 pt-16 md:px-10 md:pt-24">
        <p className="label-caps">
          The board ·{" "}
          {new Date().toLocaleDateString("en-ZA", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <div className="mt-8 flex flex-col-reverse items-center gap-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-md">
            <h1 className="display-lg max-w-[13ch]">
              <RevealWords text="Everything open, and how close it's getting." />
            </h1>
            <Reveal delay={200}>
              <p className="mt-6 text-base leading-relaxed text-muted-foreground">
                {live.length} live entries. {closing} close inside three weeks. Nothing here is
                guesswork dressed as fact — where a date is only reported, the row says so.
              </p>
            </Reveal>
          </div>
          <Reveal delay={100}>
            <BoardRadar opportunities={live} />
          </Reveal>
        </div>
      </section>

      {clashes.length > 0 && (
        <Reveal className="mx-auto max-w-[88rem] px-5 md:px-10">
          <div
            className="paper-panel border-l-4 p-5"
            style={{ borderLeftColor: "var(--critical)" }}
          >
            <p className="label-caps" style={{ color: "var(--critical)" }}>
              Collision warning
            </p>
            {clashes.map((c) => (
              <p key={c.weekStart} className="mt-2 text-base">
                Week of <strong>{c.weekLabel}</strong> — {c.items.map((i) => i.name).join(" and ")}{" "}
                land in the same week. Two committed entries, one weekend. Decide now rather than on
                the Friday.
              </p>
            ))}
          </div>
        </Reveal>
      )}

      <section className="mx-auto max-w-[88rem] px-5 pt-14 md:px-10">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-rule pb-3">
          <span className="label-caps">Sort</span>
          {(
            [
              ["deadline", "closest deadline"],
              ["probability", "win probability"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={cn(
                "font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
                sort === key
                  ? "text-foreground underline underline-offset-4"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setWatchedOnly((v) => !v)}
            className={cn(
              "ml-auto font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
              watchedOnly
                ? "text-accent underline underline-offset-4"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {watchedOnly ? "showing watched only" : "watched only"}
          </button>
        </div>

        {isLoading && <p className="py-16 text-sm text-muted-foreground">Loading the board…</p>}

        {!isLoading && rows.length === 0 && (
          <p className="py-16 text-sm text-muted-foreground">
            Nothing here. Either we've cleared the board or nobody starred anything.
          </p>
        )}

        <div>
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
      </section>
    </AppShell>
  );
}
