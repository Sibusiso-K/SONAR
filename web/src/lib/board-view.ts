/**
 * What the overview page draws, worked out from the rows. Pure, so the
 * numbers on the page can be tested without rendering it.
 */

import { daysUntil, seasonStats, toZar } from "@/lib/analytics";
import { kindLabel } from "@/lib/format";
import type { Opportunity, PastOpportunity } from "@/lib/sonar-types";

export type Dated = { o: Opportunity; days: number };

/** Rows with an upcoming date, nearest first. */
export function upcoming(live: Opportunity[], now: Date = new Date()): Dated[] {
  return live
    .map((o) => ({ o, days: daysUntil(o.next_date, now) }))
    .filter((x): x is Dated => x.days !== null && x.days >= 0)
    .sort((a, b) => a.days - b.days);
}

export type Urgency = "critical" | "warning" | "later";

/** Same thresholds as the rest of the board: a week, three weeks. */
export function urgency(days: number): Urgency {
  return days <= 7 ? "critical" : days <= 21 ? "warning" : "later";
}

export const URGENCY_COLOR: Record<Urgency, string> = {
  critical: "var(--critical)",
  warning: "var(--warning)",
  later: "var(--foreground)",
};

export function totals(live: Opportunity[], past: PastOpportunity[]) {
  const season = seasonStats(live, past);
  const best = past
    .filter((p) => p.outcome === "won" || p.outcome === "placed")
    .map((p) => p.placement)
    .find(Boolean);
  return {
    live: live.length,
    tiers: [1, 2, 3].map((t) => live.filter((o) => o.tier === t).length),
    poolZar: live.reduce((sum, o) => sum + toZar(o.prize?.pool, o.prize?.currency), 0),
    confirmed: live.filter((o) => o.confidence === "confirmed").length,
    reported: live.filter((o) => o.confidence === "reported").length,
    shaky: live.filter((o) => !["confirmed", "reported"].includes(o.confidence)).length,
    entered: season.entered,
    placed: season.placed,
    best: best ?? null,
  };
}

/** How many weeks the deadline field shows. */
export const FIELD_WEEKS = 16;

export type FieldRow = { kind: string; label: string; undated: number };
export type FieldBubble = {
  o: Opportunity;
  days: number;
  /** Index into the rows. */
  row: number;
  /** 0..1 across the field's time span. */
  x: number;
  /** Diameter in px, from the board score. */
  size: number;
  urgency: Urgency;
};

/**
 * The deadline field: one row per kind of opportunity (most common first), a
 * bubble for each row with a date inside the window, and a count of the ones
 * with no date, which is the part a calendar would hide.
 */
export function deadlineField(live: Opportunity[], now: Date = new Date()) {
  const span = FIELD_WEEKS * 7;
  const counts = new Map<string, number>();
  for (const o of live) counts.set(o.kind, (counts.get(o.kind) ?? 0) + 1);
  const kinds = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const dated = upcoming(live, now);

  const rows: FieldRow[] = kinds.map(([kind]) => ({
    kind,
    label: kindLabel(kind).replace(/\bml\b/, "ML"),
    undated: live.filter((o) => o.kind === kind && daysUntil(o.next_date, now) === null).length,
  }));
  const bubbles: FieldBubble[] = dated
    .filter((d) => d.days <= span)
    .map((d) => ({
      ...d,
      row: kinds.findIndex(([k]) => k === d.o.kind),
      x: d.days / span,
      size: Math.round(12 + (Math.max(0, Math.min(100, d.o.score)) / 100) * 28),
      urgency: urgency(d.days),
    }));
  return { rows, bubbles, beyond: dated.length - bubbles.length, dated: dated.length };
}

/** Points on a half circle for the confidence arc, left to right. */
export function arcPoints(n: number, radius: number): { x: number; y: number }[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => {
    const a = Math.PI - (n === 1 ? 0.5 : i / (n - 1)) * Math.PI;
    return { x: Math.cos(a) * radius, y: -Math.sin(a) * radius };
  });
}

/** "morning" before noon, "afternoon" until six, then "evening", on a
 * Johannesburg clock, which is the board's. */
export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Africa/Johannesburg",
    }).format(now),
  );
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
