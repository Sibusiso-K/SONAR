/**
 * Direction for page transitions.
 *
 * Moving to a later section in the sidebar order slides the page one way,
 * moving to an earlier one slides it back, and drilling into an entry (the
 * detail page) counts as going deeper. Anything unrecognised gets a plain
 * fade rather than a misleading direction.
 */

/** Sidebar order. Keep in step with NAV in components/AppShell.tsx. */
export const SECTION_ORDER = ["/", "/stats", "/radar", "/war-room", "/updates"] as const;

export type TransitionType = "forward" | "backward" | "fade";

/** Position of a path in the section order; entry detail pages sit past the
 * end (deeper than any top-level section); unknown paths return null. */
export function sectionIndex(pathname: string): number | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const i = (SECTION_ORDER as readonly string[]).indexOf(clean);
  if (i !== -1) return i;
  if (clean.startsWith("/o/")) return SECTION_ORDER.length;
  return null;
}

export function transitionType(fromPath: string | undefined, toPath: string): TransitionType {
  if (fromPath === undefined) return "fade";
  const from = sectionIndex(fromPath);
  const to = sectionIndex(toPath);
  if (from === null || to === null || from === to) return "fade";
  return to > from ? "forward" : "backward";
}
