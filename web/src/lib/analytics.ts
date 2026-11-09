import { LOCALE, formatNumber } from "./format";
import type { Opportunity, PastOpportunity, UpdateRow } from "./sonar-types";

/**
 * Rough conversion, deliberately hardcoded and visible rather than pretending
 * precision. Rates approximate ~Aug 2026 (ZAR per unit of currency). The team
 * is South African, so ZAR is the app's native comparison currency — this
 * replaced an earlier USD-based table.
 */
export const FX_TO_ZAR: Record<string, number> = {
  ZAR: 1,
  USD: 18.2,
  EUR: 19.66,
  GBP: 23.11,
};

export function toZar(pool?: number, currency?: string) {
  if (!pool) return 0;
  // Unspecified/unrecognised currency defaults to ZAR (rate 1, no
  // conversion) rather than guessing USD: every entry currently on the
  // board does specify a currency, so this only ever fires for a future
  // entry that omits one, and assuming the team's own home currency is
  // the smaller, safer error than assuming an 18x USD multiplier.
  const rate = FX_TO_ZAR[(currency ?? "ZAR").toUpperCase()] ?? 1;
  return Math.round(pool * rate);
}

/**
 * The board's calendar is South African. Every "today" and every countdown is
 * computed in this zone, not in the machine's: the server renders in UTC and
 * a visitor's browser renders in their own zone, and for two hours a day
 * (22:00-24:00 UTC) those disagree about what the date is. That showed up as
 * off-by-one countdowns and a hydration mismatch between SSR and the client.
 */
export const BOARD_TZ = "Africa/Johannesburg";

// en-CA formats as YYYY-MM-DD, which is the one stable, sortable shape.
const boardDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOARD_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD of an instant, as read on a wall clock in Johannesburg. */
export function boardDateKey(at: Date = new Date()): string {
  return boardDayFormat.format(at);
}

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/** Whole days since the Unix epoch for a YYYY-MM-DD prefix, or null. Uses UTC
 * arithmetic on the calendar date only, so DST and the host zone cannot
 * shift it. Rejects impossible dates (2026-02-31) rather than rolling over. */
function dayNumber(key: string): number | null {
  const m = DATE_PREFIX.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return ms / 86_400_000;
}

/**
 * Whole calendar days from `from` to `date` (negative once `date` has passed).
 * `from` is an instant (defaults to now) or a YYYY-MM-DD string. Returns null
 * for a missing or unparseable date; never NaN, which would render as
 * "NaN days" and fall through every severity comparison as "stable".
 */
export function daysUntil(date?: string | null, from: Date | string = new Date()): number | null {
  if (!date) return null;
  const target = dayNumber(date);
  const base = dayNumber(typeof from === "string" ? from : boardDateKey(from));
  if (target === null || base === null) return null;
  return target - base;
}

export type Severity = "critical" | "warning" | "stable" | "none";

export function severityOf(o: Opportunity): Severity {
  if (!o.next_date || o.confidence === "predicted" || o.confidence === "unconfirmed") return "none";
  const d = daysUntil(o.next_date);
  if (d === null) return "none";
  if (d <= 7) return "critical";
  if (d <= 21) return "warning";
  return "stable";
}

export const severityToken: Record<Severity, string> = {
  critical: "var(--critical)",
  warning: "var(--warning)",
  stable: "var(--stable)",
  none: "var(--unknown)",
};

/**
 * Field size, pulled out of the notes we already write. No new data collection.
 * "10,000+ students expected" -> 10000. Biggest plausible number wins.
 */
export function fieldSize(o: Opportunity): number | null {
  const text = `${o.notes ?? ""} ${o.eligibility ?? ""}`.toLowerCase();
  // A number is either digits in thousands groups ("16,000", "16 000") or a
  // plain run of digits. Groups must be exactly three digits and the match
  // cannot begin inside another number. The earlier pattern allowed any
  // digits and spaces, so "Oct 2026, 16,000+ students" read as 202,616,000.
  const re =
    /(?<![\d,.])(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*\+?\s*(participants|entrants|entries|teams|students|applicants|competitors)/g;
  let best: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number((m[1] ?? "").replace(/[,\s]/g, ""));
    if (Number.isFinite(n) && (best === null || n > best)) best = n;
  }
  return best;
}

const CONFIDENCE_FACTOR: Record<string, number> = {
  confirmed: 1,
  reported: 0.92,
  unconfirmed: 0.82,
  conflicted: 0.78,
  predicted: 0.7,
};

/**
 * Win probability, 0-100. Built only from data already on the board:
 * declared winnability, overall score, tier, and field-size signals in notes.
 * It is a ranking device, not a forecast — treat 61 vs 58 as noise.
 */
export function winProbability(o: Opportunity): number {
  const winnability = o.scores?.winnability ?? 40;
  const score = o.score ?? 50;
  const tierWeight = o.tier === 1 ? 0.9 : o.tier === 2 ? 1.0 : 1.05; // tier 1 is more contested
  const base = 0.68 * winnability + 0.32 * (score * 0.6);

  const f = fieldSize(o);
  // 40 entrants ≈ no penalty, 10,000 ≈ heavy penalty, 90,000 ≈ brutal.
  // No stated field size: fall back on scope rather than one flat number for
  // everyone — a global open call is presumptively more contested than a
  // local one, even before a headcount shows up in the notes.
  const scopeDefault = o.scope === "international" ? 0.72 : o.scope === "continental" ? 0.85 : 0.95;
  const fieldFactor = f ? clamp(1.28 - Math.log10(Math.max(f, 10)) / 4.2, 0.18, 1) : scopeDefault;

  const conf = CONFIDENCE_FACTOR[o.confidence] ?? 0.8;
  return Math.round(clamp(base * tierWeight * fieldFactor * conf, 1, 99));
}

export function expectedValueZar(o: Opportunity): number {
  return Math.round((toZar(o.prize?.pool, o.prize?.currency) * winProbability(o)) / 100);
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/* ---------------- Deadline collisions ---------------- */

export type Collision = {
  weekStart: string;
  weekLabel: string;
  items: Opportunity[];
};

/** Monday of the week containing `key`, as YYYY-MM-DD. Pure calendar math in
 * UTC, so the host timezone cannot move a date across a week boundary. */
function weekStartKey(key: string): string | null {
  const n = dayNumber(key);
  if (n === null) return null;
  const sinceMonday = (n + 3) % 7; // epoch day 0 was a Thursday
  return new Date((n - sinceMonday) * 86_400_000).toISOString().slice(0, 10);
}

export function collisions(list: Opportunity[]): Collision[] {
  const committed = list.filter(
    (o) => o.next_date && (o.confidence === "confirmed" || o.confidence === "reported"),
  );
  const buckets = new Map<string, Opportunity[]>();
  for (const o of committed) {
    const key = weekStartKey(o.next_date!);
    if (!key) continue; // unparseable date: cannot be placed in a week
    buckets.set(key, [...(buckets.get(key) ?? []), o]);
  }
  return [...buckets.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([weekStart, items]) => ({
      weekStart,
      weekLabel: new Date(`${weekStart}T00:00:00Z`).toLocaleDateString(LOCALE, {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }),
      items: items.sort((a, b) => (a.next_date! < b.next_date! ? -1 : 1)),
    }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

/* ---------------- Discovery lag ---------------- */

export type SourceLag = {
  source: string;
  avgLagDays: number;
  worstLagDays: number;
  tracked: number;
  unnoticed: number;
};

export function discoveryLag(list: Opportunity[]): SourceLag[] {
  const bySource = new Map<string, Opportunity[]>();
  for (const o of list) {
    const s = o.source?.trim() || "unattributed";
    bySource.set(s, [...(bySource.get(s) ?? []), o]);
  }
  return [...bySource.entries()]
    .map(([source, items]) => {
      const lags = items
        .filter((o) => o.went_live_on && o.noticed_on)
        .map((o) => daysUntil(o.noticed_on, o.went_live_on!))
        .filter((n): n is number => n !== null);
      return {
        source,
        avgLagDays: lags.length ? round1(lags.reduce((a, b) => a + b, 0) / lags.length) : 0,
        worstLagDays: lags.length ? Math.max(...lags) : 0,
        tracked: items.length,
        unnoticed: items.filter((o) => o.went_live_on && !o.noticed_on).length,
      };
    })
    .sort((a, b) => b.avgLagDays - a.avgLagDays);
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/* ---------------- Confidence trend ---------------- */

export type ConfidenceTrend = {
  counts: { name: string; value: number }[];
  promotions: number;
  avgPromotionDays: number | null;
  calendarSafe: number;
};

export function confidenceTrend(list: Opportunity[], updates: UpdateRow[]): ConfidenceTrend {
  const order = ["confirmed", "reported", "unconfirmed", "predicted", "conflicted"];
  const counts = order.map((name) => ({
    name,
    value: list.filter((o) => o.confidence === name).length,
  }));

  const promotionUpdates = updates.filter((u) => u.change_kind === "confidence");
  const spans: number[] = [];
  for (const u of promotionUpdates) {
    const o = list.find((x) => x.id === u.opportunity_id);
    if (!o?.went_live_on) continue;
    const d = daysUntil(u.created_at.slice(0, 10), o.went_live_on);
    if (d !== null && d >= 0) spans.push(d);
  }

  return {
    counts,
    promotions: promotionUpdates.length,
    avgPromotionDays: spans.length ? round1(spans.reduce((a, b) => a + b, 0) / spans.length) : null,
    calendarSafe: list.filter((o) => o.confidence === "confirmed").length,
  };
}

/* ---------------- Season headline stats ---------------- */

export function seasonStats(live: Opportunity[], past: PastOpportunity[]) {
  const totalPool = live.reduce((sum, o) => sum + toZar(o.prize?.pool, o.prize?.currency), 0);
  const lags = live
    .filter((o) => o.went_live_on && o.noticed_on)
    .map((o) => daysUntil(o.noticed_on, o.went_live_on!))
    .filter((n): n is number => n !== null);
  return {
    totalPoolZar: totalPool,
    discovered: live.length + past.length,
    entered: past.filter((p) => ["entered", "placed", "won", "rejected"].includes(p.outcome))
      .length,
    won: past.filter((p) => p.outcome === "won").length,
    placed: past.filter((p) => ["won", "placed"].includes(p.outcome)).length,
    missed: past.filter((p) => p.outcome === "missed").length,
    avgLag: lags.length ? round1(lags.reduce((a, b) => a + b, 0) / lags.length) : 0,
  };
}

export function formatMoney(pool?: number, currency?: string) {
  if (!pool) return "—";
  // Shows the prize as the organiser actually denominated it — never
  // converted — so an unspecified currency defaults to ZAR/"R" rather
  // than "$", matching toZar()'s reasoning above.
  const cur = (currency ?? "ZAR").toUpperCase();
  const symbol =
    cur === "ZAR" ? "R" : cur === "EUR" ? "€" : cur === "GBP" ? "£" : cur === "USD" ? "$" : cur;
  return `${symbol}${formatNumber(pool)}`;
}

export function zar(n: number) {
  // ZAR figures commonly run into the millions (a $700k USD pool is
  // ~R12.7m) where the old two-tier $/k formatter this replaced would
  // print an unreadably long number, hence the added "m" tier.
  if (n >= 1_000_000) return `R${Math.round(n / 100_000) / 10}m`;
  if (n >= 1000) return `R${Math.round(n / 100) / 10}k`;
  return `R${n}`;
}
