/**
 * Organiser mark. A logo from web/public/org-logos when one is mapped in
 * lib/org-logos.ts, otherwise a deterministic initials badge.
 *
 * Logos are served from this site, never fetched from a third party, so a
 * page view tells no one which opportunities were looked at.
 */

import { useState } from "react";
import { logoSrc } from "@/lib/org-logos";

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
  const [broken, setBroken] = useState(false);
  const src = logoSrc(organiser);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-sm bg-white object-contain p-0.5"
        style={{ width: size, height: size }}
      />
    );
  }
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
