/**
 * Organiser mark: a deterministic initials badge, the same on every visit.
 *
 * This used to load each organiser's favicon from Google's favicon service,
 * one request per organiser on every page view, which told Google which
 * opportunities each visitor looked at. That request is gone. To bring real
 * logos back, add the image files under web/public and map organiser names to
 * them here, so the page still makes no third-party request.
 */

const BADGE_COLORS = ["#0e6e75", "#a8620a", "#1b7a4b", "#7a3ea1", "#b6394a", "#3a5da8"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initialsOf(name: string) {
  const words = name.split(/[\s/&(]+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export function OrgLogo({ organiser, size = 28 }: { organiser: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-sm font-mono font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: BADGE_COLORS[hash(organiser) % BADGE_COLORS.length],
      }}
      aria-hidden
    >
      {initialsOf(organiser)}
    </span>
  );
}
