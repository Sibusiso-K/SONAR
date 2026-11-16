/**
 * What kind of opportunity a row is, and how the board treats each kind.
 *
 * Hackathons and competitions are contests: you build, you enter, a prize pool
 * is split, so a prize and an expected value mean something. Internships and
 * graduate programmes are hiring: you apply, you are selected, you are paid a
 * stipend or salary, and there is no pool to win, so showing a prize or an
 * expected value for them is wrong. Fellowships and grants sit in between and
 * keep their award figure.
 *
 * Every place that shows money or ranks by it should go through this module,
 * so the three families cannot drift apart again.
 */

export type KindGroup = "hackathon" | "competition" | "internship" | "graduate" | "funding";

const GROUP_OF: Record<string, KindGroup> = {
  hackathon: "hackathon",
  datathon: "hackathon",
  build_competition: "hackathon",
  startup_competition: "hackathon",
  challenge: "hackathon",
  competition: "competition",
  ml_competition: "competition",
  internship: "internship",
  grad_programme: "graduate",
  "grad-programme": "graduate",
  recruiting_event: "graduate",
  fellowship: "funding",
  grant: "funding",
  programme: "funding",
};

export const KIND_GROUP_LABEL: Record<KindGroup, string> = {
  hackathon: "Hackathon",
  competition: "Competition",
  internship: "Internship",
  graduate: "Graduate programme",
  funding: "Fellowship or grant",
};

export function kindGroup(kind: string | null | undefined): KindGroup | null {
  return kind ? (GROUP_OF[kind] ?? null) : null;
}

/** A reader-facing name for a kind: "Internship", or the raw kind for an
 * unknown one with underscores turned into spaces. */
export function kindName(kind: string | null | undefined): string {
  const g = kindGroup(kind);
  return g ? KIND_GROUP_LABEL[g] : (kind ?? "unknown").replace(/_/g, " ");
}

/** Internships and graduate programmes: hired, paid, no prize to win. */
export function isCareerKind(kind: string | null | undefined): boolean {
  const g = kindGroup(kind);
  return g === "internship" || g === "graduate";
}

/** The label for the money a row carries, which differs by kind. */
export function moneyLabel(kind: string | null | undefined): string {
  switch (kindGroup(kind)) {
    case "internship":
      return "stipend";
    case "graduate":
      return "salary";
    case "funding":
      return "award";
    default:
      return "prize";
  }
}
