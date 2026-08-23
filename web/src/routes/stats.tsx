import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CompetitionBaseline } from "@/components/CompetitionBaseline";
import { Reveal, RevealWords } from "@/components/Reveal";
import { Scatter3D } from "@/components/Scatter3D";
import { WinRing } from "@/components/WinRing";
import { useOpportunities, usePastOpportunities, useUpdates } from "@/lib/sonar-data";
import {
  clamp,
  collisions,
  confidenceTrend,
  daysUntil,
  discoveryLag,
  expectedValueUsd,
  fieldSize,
  seasonStats,
  severityToken,
  toUsd,
  usd,
  winProbability,
} from "@/lib/analytics";
import type { Opportunity } from "@/lib/sonar-types";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Stats: what we should actually enter | SONAR" },
      {
        name: "description",
        content:
          "Win probability, expected value, deadline collisions and discovery lag. Charts that answer a decision instead of decorating a dashboard.",
      },
      { property: "og:title", content: "Stats: what we should actually enter | SONAR" },
      {
        property: "og:description",
        content:
          "Ranking the board by win probability and expected value, forecasting deadline collisions, and tracking how slow each monitored source is.",
      },
    ],
  }),
  component: Stats,
});

/* ---------------- animated counter ---------------- */

function Counter({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const dur = 1200;
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(to * eased);
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to]);

  return (
    <span ref={ref} className="numeral tabular-nums">
      {prefix}
      {value.toLocaleString("en-ZA", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/* ---------------- page ---------------- */

function Stats() {
  const { data: all = [] } = useOpportunities();
  const { data: past = [] } = usePastOpportunities();
  const { data: updates = [] } = useUpdates();

  const live = useMemo(() => all.filter((o) => o.confidence !== "predicted"), [all]);
  const ranked = useMemo(
    () => [...live].sort((a, b) => winProbability(b) - winProbability(a)),
    [live],
  );
  const byEv = useMemo(
    () => [...live].sort((a, b) => expectedValueUsd(b) - expectedValueUsd(a)).slice(0, 8),
    [live],
  );
  const season = seasonStats(all, past);
  const clashes = collisions(live);
  const lag = discoveryLag(all);
  const trend = confidenceTrend(all, updates);
  const maxEv = Math.max(1, ...byEv.map(expectedValueUsd));

  return (
    <AppShell>
      <section className="mx-auto max-w-[88rem] px-5 pb-16 pt-16 md:px-10 md:pt-24">
        <p className="label-caps">Statistics</p>
        <h1 className="display-xl mt-5 max-w-[15ch]">
          <RevealWords text="The point of this page is to make us win more." />
        </h1>
        <Reveal delay={200}>
          <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground">
            Every number below answers a decision: what to enter, what to skip, which weekend is
            already double-booked, and which source keeps telling us things too late.
          </p>
        </Reveal>
      </section>

      {/* ---- narrative counters ---- */}
      <section className="mx-auto max-w-[88rem] px-5 md:px-10">
        <div className="grid gap-px bg-rule md:grid-cols-2">
          <StoryStat
            kicker="Tracked prize pool, live entries"
            value={<Counter to={season.totalPoolUsd} prefix="$" />}
            line="Most of it sits in one competition we will almost certainly not win. That is the whole reason expected value exists."
          />
          <StoryStat
            kicker="Discovered → entered → won"
            value={
              <>
                <Counter to={season.discovered} /> <span className="text-muted-foreground">/</span>{" "}
                <Counter to={season.entered} /> <span className="text-muted-foreground">/</span>{" "}
                <Counter to={season.won} />
              </>
            }
            line={`${season.missed} entries got away entirely. Two of those were monitoring failures, not scheduling ones.`}
          />
          <StoryStat
            kicker="Average discovery lag"
            value={<Counter to={season.avgLag} suffix=" days" decimals={1} />}
            line="Days between an opportunity going live and this board noticing. Under a week is fine. The outliers are what nearly cost us Gradhack."
          />
          <StoryStat
            kicker="Calendar-safe right now"
            value={
              <>
                <Counter to={trend.calendarSafe} />
                <span className="text-muted-foreground">/{all.length}</span>
              </>
            }
            line={
              trend.avgPromotionDays
                ? `A row takes about ${trend.avgPromotionDays} days to go from live-somewhere to confirmed-here. Pre-build accordingly.`
                : "Everything else is reported, unconfirmed, predicted or contradicting itself."
            }
          />
        </div>
      </section>

      {/* ---- measured baseline ---- */}
      <Section
        id="baseline"
        kicker="Our measured baseline"
        title="The one result we can check the model against."
        blurb="Everything else on this page is a prediction. This is the actual outcome it should be judged by."
      >
        <CompetitionBaseline />
      </Section>

      {/* ---- win probability ranking ---- */}
      <Section
        id="win-probability"
        kicker="Ranked by win probability"
        title="Deadline order is not priority order."
        blurb="Built from declared winnability, overall score, tier and field-size signals already written in the notes. A ranking device, not a forecast: treat a four-point gap as noise."
      >
        <div className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((o, i) => (
            <Reveal key={o.id} delay={Math.min(i, 6) * 45}>
              <div className="flex h-full items-start gap-4 bg-paper p-5">
                <WinRing value={winProbability(o)} size={64} />
                <div className="min-w-0">
                  <h3 className="text-base font-bold leading-tight">{o.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fieldSize(o)
                      ? `${fieldSize(o)!.toLocaleString("en-ZA")} in the field`
                      : "field size unrecorded"}
                  </p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    EV {usd(expectedValueUsd(o))} ·{" "}
                    {o.next_date ? `${daysUntil(o.next_date)}d` : "no date"}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---- expected value ---- */}
      <Section
        id="expected-value"
        kicker="Expected value"
        title="Prize pool × odds, one currency."
        blurb="So a $700k long shot and a small near-certainty can be argued about honestly. Note what this model ignores: a graduate programme with no cash prize scores zero here and is still one of the most valuable things on the board."
      >
        <div className="space-y-3">
          {byEv.map((o, i) => (
            <Reveal key={o.id} delay={Math.min(i, 8) * 40}>
              <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border pb-3">
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="truncate text-sm font-medium">{o.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {usd(toUsd(o.prize?.pool, o.prize?.currency))} pool · {winProbability(o)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full bg-secondary">
                    <div
                      className="h-2 bg-accent transition-[width] duration-1000"
                      style={{ width: `${(expectedValueUsd(o) / maxEv) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="numeral w-24 text-right text-2xl">{usd(expectedValueUsd(o))}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---- 90 day timeline ---- */}
      <Section
        id="collisions"
        kicker="Next 90 days"
        title="Where the weekends collide."
        blurb="Positioned by date, not listed by row. Overlapping cards are overlapping commitments."
      >
        <Timeline items={live} />
        {clashes.length > 0 && (
          <div className="mt-6 space-y-2">
            {clashes.map((c) => {
              const ranked = [...c.items].sort((a, b) => expectedValueUsd(b) - expectedValueUsd(a));
              const [lead, ...rest] = ranked;
              return (
                <p
                  key={c.weekStart}
                  className="border-l-4 bg-paper p-4 text-sm"
                  style={{ borderLeftColor: "var(--critical)" }}
                >
                  <strong>Week of {c.weekLabel}:</strong>{" "}
                  {c.items.map((i) => `${i.name} (${i.next_date})`).join(" and ")}.{" "}
                  {lead && rest.length > 0 && (
                    <>
                      Higher expected value:{" "}
                      <strong>
                        {lead.name} ({usd(expectedValueUsd(lead))}
                        {" vs "}
                        {rest.map((r) => usd(expectedValueUsd(r))).join(", ")})
                      </strong>
                      . Not a mandate: EV ignores career leverage and grad programmes score zero
                      here, but if you're only leading on one, that's the one.
                    </>
                  )}
                </p>
              );
            })}
          </div>
        )}
      </Section>

      {/* ---- scatter ---- */}
      <Section
        id="scatter"
        kicker="Winnability vs prize vs leverage"
        title="Explore it from any angle."
        blurb="A 3D scatter, not a fixed chart: swap what's on each axis, rotate it, zoom in on one cluster. Defaults: winnability, prize (log), career leverage."
      >
        <Scatter3D opportunities={live} />
      </Section>

      {/* ---- discovery lag ---- */}
      <Section
        id="lag"
        kicker="Discovery lag by source"
        title="Which monitors are slow."
        blurb="Days between an opportunity going live and this board noticing it. Word of mouth is not a monitoring strategy: it is how we caught Entelect, by luck."
      >
        <div className="grid gap-px bg-rule md:grid-cols-2">
          {lag.map((s, i) => (
            <Reveal key={s.source} delay={Math.min(i, 8) * 40}>
              <div className="bg-paper p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium">{s.source}</span>
                  <span
                    className="numeral text-3xl"
                    style={{
                      color:
                        s.avgLagDays > 7
                          ? "var(--critical)"
                          : s.avgLagDays > 3
                            ? "var(--warning)"
                            : "var(--stable)",
                    }}
                  >
                    {s.avgLagDays}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-secondary">
                  <div
                    className="h-1.5"
                    style={{
                      width: `${clamp((s.avgLagDays / 14) * 100, 3, 100)}%`,
                      backgroundColor:
                        s.avgLagDays > 7
                          ? "var(--critical)"
                          : s.avgLagDays > 3
                            ? "var(--warning)"
                            : "var(--stable)",
                    }}
                  />
                </div>
                <p className="label-caps mt-2">
                  {s.tracked} tracked · worst {s.worstLagDays}d
                  {s.unnoticed > 0 ? ` · ${s.unnoticed} never noticed` : ""}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---- confidence ---- */}
      <Section
        id="confidence"
        kicker="Confidence mix"
        title="How much of the board is actually trustworthy."
        blurb={
          trend.avgPromotionDays
            ? `${trend.promotions} confidence promotions logged, averaging ${trend.avgPromotionDays} days from going live to being confirmed here. That is the pre-build window.`
            : "No confidence promotions logged yet."
        }
      >
        <div className="flex h-16 w-full overflow-hidden">
          {trend.counts
            .filter((c) => c.value > 0)
            .map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-center border-r border-background"
                style={{
                  width: `${(c.value / Math.max(1, all.length)) * 100}%`,
                  backgroundColor:
                    c.name === "confirmed"
                      ? "var(--stable)"
                      : c.name === "reported"
                        ? "var(--warning)"
                        : c.name === "conflicted"
                          ? "var(--critical)"
                          : "var(--unknown)",
                }}
                title={`${c.name}: ${c.value}`}
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-background">
                  {c.value}
                </span>
              </div>
            ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {trend.counts.map((c) => (
            <span key={c.name} className="label-caps">
              {c.name} {c.value}
            </span>
          ))}
        </div>
      </Section>

      {/* ---- season so far ---- */}
      <Section
        id="season"
        kicker="Season so far"
        title="Outcomes, unedited."
        blurb="Wins, placements, rejections and misses in the order they happened."
      >
        <div className="flex gap-px overflow-x-auto bg-rule pb-1">
          {[...past]
            .sort((a, b) => (a.happened_on ?? "").localeCompare(b.happened_on ?? ""))
            .map((p) => (
              <div key={p.id} className="min-w-[13rem] flex-1 bg-paper p-4">
                <div
                  className="h-1 w-full"
                  style={{
                    backgroundColor:
                      p.outcome === "won" || p.outcome === "placed"
                        ? "var(--stable)"
                        : p.outcome === "missed"
                          ? "var(--critical)"
                          : "var(--warning)",
                  }}
                />
                <p className="label-caps mt-3">{p.happened_on}</p>
                <p className="mt-1 text-sm font-bold leading-tight">{p.name}</p>
                <p className="mt-2 font-display text-xl font-bold">{p.placement || p.outcome}</p>
                {p.corrected && <p className="label-caps mt-1">corrected later</p>}
              </div>
            ))}
        </div>
      </Section>
    </AppShell>
  );
}

/* ---------------- sub-components ---------------- */

function Section({
  id,
  kicker,
  title,
  blurb,
  children,
}: {
  id?: string;
  kicker: string;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-[88rem] scroll-mt-24 px-5 pt-24 md:px-10">
      <Reveal>
        <p className="label-caps">{kicker}</p>
        <h2 className="display-lg mt-3 max-w-[18ch]">{title}</h2>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{blurb}</p>
      </Reveal>
      <div className="mt-10">{children}</div>
    </section>
  );
}

function StoryStat({
  kicker,
  value,
  line,
}: {
  kicker: string;
  value: React.ReactNode;
  line: string;
}) {
  return (
    <Reveal className="bg-paper p-8 md:p-12">
      <p className="label-caps">{kicker}</p>
      <div className="mt-4 text-[clamp(2.5rem,6vw,4.5rem)]">{value}</div>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{line}</p>
    </Reveal>
  );
}

function Timeline({ items }: { items: Opportunity[] }) {
  const dated = items
    .filter((o) => {
      const d = daysUntil(o.next_date);
      return d !== null && d >= 0 && d <= 90;
    })
    .sort((a, b) => (a.next_date! < b.next_date! ? -1 : 1));

  if (dated.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing lands in the next 90 days.</p>;
  }

  const lanes: Opportunity[][] = [];
  const placed = new Map<string, number>();
  for (const o of dated) {
    const d = daysUntil(o.next_date)!;
    let lane = 0;
    while (lanes[lane]?.some((other) => Math.abs(daysUntil(other.next_date)! - d) < 12)) {
      lane++;
    }
    lanes[lane] = [...(lanes[lane] ?? []), o];
    placed.set(o.id, lane);
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative min-w-[56rem]" style={{ height: `${lanes.length * 7.5 + 3}rem` }}>
        {[0, 30, 60, 90].map((mark) => (
          <div
            key={mark}
            className="absolute top-0 h-full"
            style={{ left: `${(mark / 90) * 100}%` }}
          >
            <div className="h-full w-px bg-rule" />
            <span className="label-caps absolute -top-5 left-1 whitespace-nowrap">
              {mark === 0 ? "today" : `+${mark}d`}
            </span>
          </div>
        ))}
        {dated.map((o) => {
          const d = daysUntil(o.next_date)!;
          const lane = placed.get(o.id) ?? 0;
          const sev = d <= 7 ? "critical" : d <= 21 ? "warning" : "stable";
          return (
            <div
              key={o.id}
              className="absolute w-[13rem] border-l-4 bg-paper p-3 shadow-sm"
              style={{
                left: `min(${(d / 90) * 100}%, calc(100% - 13rem))`,
                top: `${lane * 7.5 + 1.5}rem`,
                borderLeftColor: severityToken[sev],
              }}
            >
              <p className="label-caps">{o.next_date}</p>
              <p className="mt-1 truncate text-sm font-bold">{o.name}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {d}d · win {winProbability(o)}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
