import type { Opportunity } from "./sonar-types";
import { daysUntil, expectedValueUsd, fieldSize, toUsd, usd, winProbability } from "./analytics";

/** One selectable axis (or size) for the 3D scatter on /stats. `get` returns
 * null when an opportunity has no value for it — those points are excluded
 * from whichever axis needs them, never faked with a fallback number. */
export type Metric = {
  id: string;
  label: string;
  axisLabel: string;
  /** Log-scaled before normalising — prize/EV/field-size all span orders
   * of magnitude and would otherwise pile every point into one corner. */
  log?: boolean;
  get: (o: Opportunity) => number | null;
  format: (v: number) => string;
};

export const METRICS: Metric[] = [
  {
    id: "winnability",
    label: "Winnability (declared)",
    axisLabel: "WINNABILITY",
    get: (o) => o.scores?.winnability ?? null,
    format: (v) => `${Math.round(v)}`,
  },
  {
    id: "win_probability",
    label: "Win probability (modeled)",
    axisLabel: "WIN PROBABILITY",
    get: (o) => winProbability(o),
    format: (v) => `${Math.round(v)}%`,
  },
  {
    id: "career_leverage",
    label: "Career leverage",
    axisLabel: "CAREER LEVERAGE",
    get: (o) => o.scores?.career_leverage ?? null,
    format: (v) => `${Math.round(v)}`,
  },
  {
    id: "urgency",
    label: "Urgency score",
    axisLabel: "URGENCY",
    get: (o) => o.scores?.urgency ?? null,
    format: (v) => `${Math.round(v)}`,
  },
  {
    id: "overall_score",
    label: "Overall score",
    axisLabel: "OVERALL SCORE",
    get: (o) => (typeof o.score === "number" ? o.score : null),
    format: (v) => `${Math.round(v)}`,
  },
  {
    id: "prize_usd",
    label: "Prize pool (USD)",
    axisLabel: "PRIZE, LOG",
    log: true,
    get: (o) => {
      const v = toUsd(o.prize?.pool, o.prize?.currency);
      return v > 0 ? v : null;
    },
    format: (v) => usd(v),
  },
  {
    id: "expected_value",
    label: "Expected value (USD)",
    axisLabel: "EXPECTED VALUE, LOG",
    log: true,
    get: (o) => {
      const v = expectedValueUsd(o);
      return v > 0 ? v : null;
    },
    format: (v) => usd(v),
  },
  {
    id: "days_until",
    label: "Days until deadline",
    axisLabel: "DAYS LEFT",
    get: (o) => daysUntil(o.next_date),
    format: (v) => `${Math.round(v)}d`,
  },
  {
    id: "field_size",
    label: "Field size (est.)",
    axisLabel: "FIELD SIZE, LOG",
    log: true,
    get: (o) => fieldSize(o),
    format: (v) => Math.round(v).toLocaleString("en-ZA"),
  },
];

export function metricById(id: string): Metric {
  return METRICS.find((m) => m.id === id) ?? METRICS[0]!;
}

/* ---------------- color schemes ---------------- */

export type ColorScheme = {
  id: string;
  label: string;
  colorOf: (o: Opportunity) => string;
  legend: (items: Opportunity[]) => { label: string; color: string }[];
};

// three.js reads colors at the WebGL level — needs concrete hex, not CSS
// custom properties. Tier hex matches EventGlobe's palette for consistency.
const TIER_HEX: Record<number, string> = { 1: "#3fbfc4", 2: "#c98a2c", 3: "#8a8580" };
const CONFIDENCE_HEX: Record<string, string> = {
  confirmed: "#4e9a63",
  reported: "#c98a2c",
  unconfirmed: "#8a8580",
  conflicted: "#c1543f",
  predicted: "#8a8580",
};
const CATEGORY_PALETTE = [
  "#3fbfc4",
  "#c98a2c",
  "#c1543f",
  "#4e9a63",
  "#7a6fc9",
  "#c95f9e",
  "#5f9fc9",
  "#9ca35c",
];

function hashHex(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length]!;
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: "tier",
    label: "Color: tier",
    colorOf: (o) => TIER_HEX[o.tier ?? 3] ?? TIER_HEX[3]!,
    legend: () => [1, 2, 3].map((t) => ({ label: `Tier ${t}`, color: TIER_HEX[t]! })),
  },
  {
    id: "confidence",
    label: "Color: confidence",
    colorOf: (o) => CONFIDENCE_HEX[o.confidence] ?? CONFIDENCE_HEX["predicted"]!,
    legend: (items) => {
      const seen = new Set(items.map((o) => o.confidence));
      return [...seen].map((c) => ({
        label: c,
        color: CONFIDENCE_HEX[c] ?? CONFIDENCE_HEX["predicted"]!,
      }));
    },
  },
  {
    id: "kind",
    label: "Color: kind",
    colorOf: (o) => hashHex(o.kind ?? "unknown"),
    legend: (items) => {
      const seen = new Set(items.map((o) => o.kind ?? "unknown"));
      return [...seen].map((k) => ({ label: k, color: hashHex(k) }));
    },
  },
  {
    id: "scope",
    label: "Color: scope",
    colorOf: (o) => hashHex(o.scope ?? "unknown"),
    legend: (items) => {
      const seen = new Set(items.map((o) => o.scope ?? "unknown"));
      return [...seen].map((s) => ({ label: s, color: hashHex(s) }));
    },
  },
];

export function colorSchemeById(id: string): ColorScheme {
  return COLOR_SCHEMES.find((c) => c.id === id) ?? COLOR_SCHEMES[0]!;
}
