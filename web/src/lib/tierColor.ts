/** Priority = tier. Its own palette, distinct from the days-remaining
 * severity colours used on Board rows, so "closes soon" and "matters
 * most" don't get visually conflated. Shared by the calendar and globe. */
export const TIER_COLOR: Record<number, string> = {
  1: "var(--accent)",
  2: "var(--warning)",
  3: "var(--unknown)",
};

export function tierColor(tier: number | null | undefined) {
  return TIER_COLOR[tier ?? 3] ?? TIER_COLOR[3];
}
