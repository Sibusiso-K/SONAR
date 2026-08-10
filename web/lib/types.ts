export type Kind =
  | "hackathon"
  | "datathon"
  | "ml_competition"
  | "build_competition"
  | "challenge"
  | "competition"
  | "grad_programme"
  | "recruiting_event"
  | "accelerator"
  | "bursary";

export type Confidence =
  | "confirmed"
  | "corroborated"
  | "reported"
  | "unconfirmed"
  | "predicted"
  | "conflicted";

export type CareerTrack = "direct" | "adjacent" | "none";

/** Urgency drives the severity stripe and countdown colour. */
export type Tone = "critical" | "warning" | "stable" | "none";

export interface Prize {
  currency?: string | null;
  pool?: number | null;
  breakdown?: Record<string, unknown> | unknown[] | null;
  non_cash?: string | unknown[] | null;
}

export interface Opportunity {
  id: string;
  name: string;
  organiser: string;
  scope: "local" | "continental" | "international";
  format?: string;
  location?: string;
  status: string;
  lifecycle: string;
  kind: Kind;
  career_track: CareerTrack;
  tier: number | null;
  score: number | null;
  scores?: Record<string, number | null>;
  dates: Record<string, string | null | undefined>;
  next_date: string | null;
  next_date_label: string | null;
  days_remaining: number | null;
  confidence: Confidence;
  prize?: Prize;
  eligibility?: string;
  team_fit?: string;
  what_to_build?: string;
  scoring_formula?: string;
  deliverables?: string[];
  links?: Record<string, string>;
  notes?: string;
  tracks?: unknown[];
  challenges?: unknown[];
  stages?: unknown[];
  evidence?: unknown[];
  history?: unknown[];
}

export interface PastItem {
  name: string;
  /** Short, UI-safe first-two-sentences version of `reason`. */
  summary: string;
  reason: string;
  link?: string | null;
  missed?: boolean;
}

export interface Source {
  name: string;
  url: string;
  cadence: string;
  note?: string;
}

export interface Board {
  meta: {
    team: string[];
    base_timezone: string;
    last_updated: string;
    next_review: string;
    generated: string;
    scoring_weights: Record<string, number>;
    kinds: Record<string, string>;
    career_tracks: Record<string, string>;
  };
  opportunities: Opportunity[];
  past: PastItem[];
  monitoring_sources: Source[];
}
