import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Most organisers' `links.main` points at a third-party event platform
 * (Devpost, BeMyApp, Eightfold), not the organiser's own domain — using
 * that for a logo lookup would show the platform's brand, not theirs. This
 * is a small, curated map instead: match a recognisable fragment of the
 * organiser string to their real domain, keyed lowercase.
 */
const ORG_DOMAIN: [string, string][] = [
  ["africa deep tech foundation", "africadeeptech.org"],
  ["bcg platinion", "bcgplatinion.com"],
  ["ibm", "ibm.com"],
  ["revenuecat", "revenuecat.com"],
  ["sita", "govtech.gov.za"],
  ["govtech", "govtech.gov.za"],
  ["radiological society of north america", "kaggle.com"],
  ["fnb", "fnb.co.za"],
  ["mtn", "mtn.com"],
  ["mintek", "mintek.co.za"],
  ["unesco", "unesco.org"],
  ["zindi", "zindi.africa"],
  ["geekulcha", "geekulcha.com"],
  ["huawei", "huawei.com"],
  ["entelect", "entelect.co.za"],
  ["nasa", "nasa.gov"],
];

function domainFor(organiser: string): string | null {
  const lower = organiser.toLowerCase();
  const hit = ORG_DOMAIN.find(([key]) => lower.includes(key));
  return hit ? hit[1] : null;
}

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

/** Real logo when the organiser's domain is known and loads; a deterministic
 * initials badge otherwise — never a broken image or a wrong company's mark. */
export function OrgLogo({ organiser, size = 28 }: { organiser: string; size?: number }) {
  const domain = domainFor(organiser);
  const [failed, setFailed] = useState(false);

  if (domain && !failed) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-sm border border-border bg-white object-contain p-0.5"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-sm font-mono font-bold text-white")}
      style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: BADGE_COLORS[hash(organiser) % BADGE_COLORS.length] }}
      aria-hidden
    >
      {initialsOf(organiser)}
    </span>
  );
}
