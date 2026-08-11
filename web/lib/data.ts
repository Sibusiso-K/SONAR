import raw from "@/data/opportunities.json";
import type { Board, Confidence, Kind, Opportunity, Tone } from "./types";

const board = raw as unknown as Board;

/* ------------------------------------------------------------------ *
 * Dates are recomputed at build time, not read from the JSON.
 * `days_remaining` is baked in by the Python migration and goes stale
 * the moment the clock rolls over — so the site recomputes from
 * `next_date` on every build. A daily rebuild keeps countdowns honest.
 * ------------------------------------------------------------------ */

export const BUILT_AT = new Date();

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const ms = startOfDay(target).getTime() - startOfDay(BUILT_AT).getTime();
  return Math.round(ms / 86_400_000);
}

/** Severity ramp. Deliberately coarse — a person should read it at a glance. */
export function toneFor(days: number | null): Tone {
  if (days === null) return "none";
  if (days <= 7) return "critical";
  if (days <= 21) return "warning";
  return "stable";
}

export function withDerived(o: Opportunity): Opportunity {
  const days = daysUntil(o.next_date);
  return { ...o, days_remaining: days };
}

export function allOpportunities(): Opportunity[] {
  return board.opportunities.map(withDerived);
}

/** Live = has an upcoming date OR is actively being monitored. */
export function liveOpportunities(): Opportunity[] {
  return allOpportunities()
    .filter((o) => o.status !== "past" && o.status !== "dropped")
    .sort((a, b) => {
      const ad = a.days_remaining, bd = b.days_remaining;
      if (ad !== null && bd !== null) return ad - bd;
      if (ad !== null) return -1;
      if (bd !== null) return 1;
      return (b.score ?? 0) - (a.score ?? 0);
    });
}

/** Anything we can't yet put on a committed calendar. */
export function radarOpportunities(): Opportunity[] {
  const unsafe: Confidence[] = ["unconfirmed", "predicted", "conflicted", "reported"];
  return allOpportunities()
    .filter((o) => unsafe.includes(o.confidence))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function getOpportunity(id: string): Opportunity | undefined {
  const found = board.opportunities.find((o) => o.id === id);
  return found ? withDerived(found) : undefined;
}

export function opportunityIds(): string[] {
  return board.opportunities.map((o) => o.id);
}

export function past() {
  return board.past;
}
export function sources() {
  return board.monitoring_sources;
}
export function meta() {
  return board.meta;
}

/* ------------------------------------------------------------------ labels */

export const KIND_LABEL: Record<Kind, string> = {
  hackathon: "Hackathon",
  datathon: "Datathon",
  ml_competition: "ML competition",
  build_competition: "Build & ship",
  challenge: "Challenge",
  competition: "Competition",
  grad_programme: "Grad programme",
  recruiting_event: "Recruiting event",
  accelerator: "Accelerator",
  bursary: "Bursary",
};

export const CONFIDENCE_TONE: Record<Confidence, "stable" | "brand" | "warning" | "critical" | "neutral"> = {
  confirmed: "stable",
  corroborated: "brand",
  reported: "warning",
  unconfirmed: "neutral",
  predicted: "neutral",
  conflicted: "critical",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  confirmed: "Confirmed",
  corroborated: "Corroborated",
  reported: "Reported",
  unconfirmed: "Unverified",
  predicted: "Predicted",
  conflicted: "Conflicted",
};

/* ------------------------------------------------------------------ money */

/* Plain string math, not Intl/toLocaleString: ICU data for "en-ZA" thousands
   grouping is not guaranteed identical between the Node build and the
   browser hydrating it, which was silently causing a React #418 hydration
   mismatch on every row with a priced prize pool. */
function groupThousands(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatPrize(o: Opportunity): string {
  const p = o.prize;
  if (!p) return "—";
  if (typeof p.pool === "number" && p.pool > 0) {
    const cur = p.currency ?? "";
    return `${cur} ${groupThousands(p.pool)}`.trim();
  }
  if (p.non_cash) return "Non-cash";
  return "TBA";
}

/** Total tracked cash, converted to a single display currency for the tile. */
const FX_TO_USD: Record<string, number> = { USD: 1, ZAR: 0.055, EUR: 1.08, GBP: 1.27 };

export function totalTrackedUsd(list: Opportunity[]): number {
  return list.reduce((sum, o) => {
    const pool = o.prize?.pool;
    if (typeof pool !== "number") return sum;
    const rate = FX_TO_USD[o.prize?.currency ?? "USD"] ?? 1;
    return sum + pool * rate;
  }, 0);
}

export function compactUsd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${Math.round(n)}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

/** Words that must keep their casing when a snake_case key becomes a label. */
const CASING: Record<string, string> = {
  sast: "SAST",
  pdt: "PDT",
  utc: "UTC",
  african: "African",
  africa: "Africa",
  ai: "AI",
  ml: "ML",
  ibm: "IBM",
  gpu: "GPU",
  sa: "SA",
  api: "API",
  ics: "ICS",
};

export function prettyLabel(s: string | null | undefined): string {
  if (!s) return "";
  const words = s.replace(/_/g, " ").split(" ").filter(Boolean);
  return words
    .map((w, i) => {
      const fixed = CASING[w.toLowerCase()];
      if (fixed) return fixed;
      return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    })
    .join(" ");
}

/**
 * Date keys read better as "Submission deadline (SAST)" than
 * "Submission deadline sast". The SAST variant of a deadline is the one that
 * actually matters locally — ADTC's cutoff is 08:45 the *next morning* here.
 */
export function dateLabel(key: string): string {
  if (key.endsWith("_sast")) {
    return `${prettyLabel(key.slice(0, -5))} (SAST)`;
  }
  return prettyLabel(key);
}

/**
 * Links in the board are not all URLs — some entries carry a contact email
 * (BCG Platinion) or a bare phone number. Render each safely rather than
 * assuming `new URL()` will parse.
 */
export function describeLink(value: string): { href: string; label: string; external: boolean } {
  const v = value.trim();

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return { href: `mailto:${v}`, label: v, external: false };
  }
  if (v.startsWith("mailto:")) {
    return { href: v, label: v.slice(7), external: false };
  }
  if (v.startsWith("tel:")) {
    return { href: v, label: v.slice(4), external: false };
  }
  try {
    const u = new URL(v);
    return {
      href: v,
      label: u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : ""),
      external: true,
    };
  } catch {
    return { href: v, label: v, external: false };
  }
}

/** First link that is actually a web page — skips emails and phone numbers. */
export function primaryUrl(links: Record<string, string> | undefined): string | undefined {
  if (!links) return undefined;
  const preferred = ["main", "devpost", "apply", "kaggle", "register"];
  const candidates = [
    ...preferred.map((k) => links[k]).filter(Boolean),
    ...Object.values(links),
  ];
  return candidates.find((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  });
}
