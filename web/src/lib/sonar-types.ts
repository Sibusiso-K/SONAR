export type Confidence = "confirmed" | "reported" | "unconfirmed" | "predicted" | "conflicted";

export type Scores = {
  career_leverage?: number;
  winnability?: number;
  prize?: number;
  urgency?: number;
};

export type Prize = {
  currency?: string;
  pool?: number;
  breakdown?: string;
};

export type Opportunity = {
  id: string;
  name: string;
  organiser: string;
  kind: string;
  format: string;
  scope: string;
  tier: number;
  score: number;
  scores: Scores;
  dates: Record<string, string>;
  next_date: string | null;
  confidence: Confidence;
  prize: Prize;
  career_track: string;
  eligibility: string | null;
  what_to_build: string | null;
  deliverables: string | null;
  links: Record<string, string>;
  notes: string | null;
  source: string | null;
  went_live_on: string | null;
  noticed_on: string | null;
  archived: boolean;
  created_at: string;
};

export type PastOpportunity = {
  id: string;
  name: string;
  organiser: string;
  kind: string;
  happened_on: string | null;
  outcome: string;
  placement: string | null;
  note: string | null;
  corrected: boolean;
  correction_note: string | null;
};

export type UpdateRow = {
  id: string;
  opportunity_id: string | null;
  actor: string;
  actor_kind: string;
  change_kind: string;
  summary: string;
  detail: string | null;
  created_at: string;
};

export type WatchRow = {
  id: string;
  opportunity_id: string;
  watched_by: string;
  created_at: string;
};
