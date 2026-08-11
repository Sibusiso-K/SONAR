"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Confidence, Opportunity, Tone } from "@/lib/types";
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_TONE,
  KIND_LABEL,
  formatPrize,
  prettyLabel,
  toneFor,
} from "@/lib/data";
import { useWatchlist } from "@/lib/watchlist";

/* ------------------------------------------------------------------ chips */

export function Chip({
  children,
  tone,
  dot,
  square,
}: {
  children: React.ReactNode;
  tone?: "stable" | "warning" | "critical" | "brand" | "neutral";
  dot?: boolean;
  square?: boolean;
}) {
  return (
    <span className={square ? "chip sq" : "chip"} data-tone={tone === "neutral" ? undefined : tone}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function ConfidenceChip({ c }: { c: Confidence }) {
  return (
    <Chip tone={CONFIDENCE_TONE[c]} dot>
      {CONFIDENCE_LABEL[c]}
    </Chip>
  );
}

/* Organisers don't ship a logo feed we can pull from, and hotlinking
   trademarked company logos into a public site is its own can of worms —
   so this is a deterministic initials badge, not a real logo. */
const ORG_COLORS = ["#0e6e75", "#a8620a", "#1b7a4b", "#7a3ea1", "#b6394a", "#3a5da8"];

function orgHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function OrgIcon({ name, size = 22 }: { name: string; size?: number }) {
  const initials = name
    .split(/[\s/&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const color = ORG_COLORS[orgHash(name) % ORG_COLORS.length];
  return (
    <span
      className="orgicon"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
      title={name}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

const FORMAT_LABEL: Record<string, string> = {
  "in-person": "In-person",
  online: "Online",
  hybrid: "Hybrid",
  virtual: "Online",
};

export function FormatChip({ format }: { format?: string }) {
  if (!format) return null;
  return <Chip square>{FORMAT_LABEL[format] ?? prettyLabel(format)}</Chip>;
}

export function TierBadge({ tier }: { tier: number | null }) {
  return (
    <span className="tierbadge" data-t={tier ?? "?"} title={tier ? `Tier ${tier}` : "Unscored"}>
      {tier ?? "–"}
    </span>
  );
}

/* --------------------------------------------------------------- countdown */

export function Countdown({ days, tone }: { days: number | null; tone: Tone }) {
  if (days === null) {
    return (
      <div className="cd" data-t="none">
        —
      </div>
    );
  }
  if (days < 0) {
    return (
      <div className="cd" data-t="none">
        passed
      </div>
    );
  }
  return (
    <div className="cd" data-t={tone}>
      {days}
      <span className="d">d</span>
    </div>
  );
}

/* ------------------------------------------------------------- board rows */

export function WatchStar({ id }: { id: string }) {
  const { isWatching, toggle } = useWatchlist();
  const on = isWatching(id);
  return (
    <button
      type="button"
      className="watchbtn"
      data-on={on}
      aria-pressed={on}
      aria-label={on ? "Stop watching" : "Watch this opportunity"}
      title={on ? "Stop watching" : "Watch this opportunity"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
    >
      {on ? "★" : "☆"}
    </button>
  );
}

export function BoardHeader() {
  return (
    <div className="board-hd" role="row">
      <div role="columnheader" aria-hidden />
      <div role="columnheader" aria-hidden />
      <div role="columnheader" style={{ textAlign: "right" }}>Closes</div>
      <div role="columnheader">Opportunity</div>
      <div role="columnheader">Type</div>
      <div role="columnheader" style={{ textAlign: "center" }}>Tier</div>
      <div role="columnheader" style={{ textAlign: "right" }}>Prize</div>
      <div role="columnheader">Confidence</div>
    </div>
  );
}

export function OpportunityRow({ o }: { o: Opportunity }) {
  const tone = toneFor(o.days_remaining);
  return (
    <Link href={`/o/${o.id}/`} className="row" role="row">
      <div className="stripe" data-t={tone} aria-hidden />
      <div className="watchcell" role="cell">
        <WatchStar id={o.id} />
      </div>
      <div className="cdcell" role="cell">
        <Countdown days={o.days_remaining} tone={tone} />
      </div>
      <div className="nmcell" role="cell">
        <div className="nmrow">
          <OrgIcon name={o.organiser} />
          <div className="nm">{o.name}</div>
        </div>
        <div className="org">
          {o.organiser}
          {o.next_date_label && (
            <>
              {" · "}
              <span className="dt">{prettyLabel(o.next_date_label)}</span>
            </>
          )}
        </div>
      </div>
      <div className="kindcell" role="cell">
        <Chip square>{KIND_LABEL[o.kind] ?? o.kind}</Chip>
        <FormatChip format={o.format} />
        {o.career_track === "direct" && <Chip tone="brand">Hiring</Chip>}
      </div>
      <div className="tiercell" role="cell">
        <TierBadge tier={o.tier} />
      </div>
      <div className="prizecell" role="cell">
        <div className={formatPrize(o) === "—" ? "prize none" : "prize"}>{formatPrize(o)}</div>
      </div>
      <div className="confcell" role="cell">
        <ConfidenceChip c={o.confidence} />
      </div>
    </Link>
  );
}

export function Board({ items }: { items: Opportunity[] }) {
  if (items.length === 0) {
    return <div className="empty">Nothing matches those filters.</div>;
  }
  return (
    <div className="board" role="table">
      <BoardHeader />
      {items.map((o) => (
        <OpportunityRow key={o.id} o={o} />
      ))}
    </div>
  );
}

/* --------------------------------------------------------- filterable board */

export function FilterableBoard({ items }: { items: Opportunity[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const [watchingOnly, setWatchingOnly] = useState(false);
  const { ids: watched } = useWatchlist();

  const kinds = useMemo(
    () => [...new Set(items.map((o) => o.kind))].sort((a, b) => (KIND_LABEL[a] ?? a).localeCompare(KIND_LABEL[b] ?? b)),
    [items]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((o) => {
      if (watchingOnly && !watched.has(o.id)) return false;
      if (kind && o.kind !== kind) return false;
      if (needle && !`${o.name} ${o.organiser}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, q, kind, watchingOnly, watched]);

  return (
    <>
      <div className="filters">
        <input
          className="search"
          type="search"
          placeholder="Search opportunities…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search opportunities"
        />
        <button
          type="button"
          className="fbtn"
          data-on={watchingOnly}
          onClick={() => setWatchingOnly((v) => !v)}
        >
          ★ Watching{watched.size > 0 ? ` (${watched.size})` : ""}
        </button>
        <span className="fsep" aria-hidden />
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            className="fbtn"
            data-on={kind === k}
            onClick={() => setKind((cur) => (cur === k ? null : k))}
          >
            {KIND_LABEL[k] ?? k}
          </button>
        ))}
      </div>
      <Board items={filtered} />
    </>
  );
}

/* ------------------------------------------------------------------ tiles */

export function Tile({
  label,
  value,
  unit,
  meta,
  tone,
}: {
  label: string;
  value: string | number;
  unit?: string;
  meta?: string;
  tone?: "critical" | "warning";
}) {
  return (
    <div className="tile" data-tone={tone}>
      <div className="k">{label}</div>
      <div className="v">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {meta && <div className="m">{meta}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- alerts */

export function Alert({
  kind = "critical",
  head,
  children,
}: {
  kind?: "critical" | "warn";
  head: string;
  children: React.ReactNode;
}) {
  return (
    <div className={kind === "warn" ? "alert warn" : "alert"}>
      <div className="ic">{kind === "warn" ? "!" : "!!"}</div>
      <div className="bd">
        <div className="hd">{head}</div>
        <div className="tx">{children}</div>
      </div>
    </div>
  );
}
