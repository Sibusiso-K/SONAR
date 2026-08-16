import type { ParticipationStatus } from "./sonar-types";

/**
 * The team's own participation state — distinct from `confidence` (how
 * trustworthy the date is) and `severityOf` (how close the deadline is).
 * Four states the board needs to say out loud: signed up, approved, still
 * to submit, not competing. Everything else in the status vocabulary
 * collapses into "still to submit" (nothing's been done yet) since that's
 * the honest default rather than a fifth state to track.
 */
export type ParticipationBadge = {
  label: string;
  color: string;
};

const MAP: Partial<Record<ParticipationStatus, ParticipationBadge>> = {
  registered: { label: "signed up", color: "var(--accent)" },
  selected: { label: "approved", color: "var(--stable)" },
  submitted: { label: "submitted", color: "var(--accent)" },
  dropped: { label: "not competing", color: "var(--unknown)" },
};

export function participationBadge(status: string | null | undefined): ParticipationBadge {
  if (status && status in MAP) return MAP[status as ParticipationStatus]!;
  return { label: "still to submit", color: "var(--unknown)" };
}
