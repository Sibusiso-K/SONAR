import Link from "next/link";
import type { Confidence, Opportunity, Tone } from "@/lib/types";
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_TONE,
  KIND_LABEL,
  formatPrize,
  prettyLabel,
  toneFor,
} from "@/lib/data";

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

export function BoardHeader() {
  return (
    <div className="board-hd" role="row">
      <div />
      <div style={{ textAlign: "right" }}>Closes</div>
      <div>Opportunity</div>
      <div>Type</div>
      <div style={{ textAlign: "center" }}>Tier</div>
      <div style={{ textAlign: "right" }}>Prize</div>
      <div>Confidence</div>
    </div>
  );
}

export function OpportunityRow({ o }: { o: Opportunity }) {
  const tone = toneFor(o.days_remaining);
  return (
    <Link href={`/o/${o.id}/`} className="row" role="row">
      <div className="stripe" data-t={tone} aria-hidden />
      <div className="cdcell">
        <Countdown days={o.days_remaining} tone={tone} />
      </div>
      <div className="nmcell">
        <div className="nm">{o.name}</div>
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
      <div className="kindcell">
        <Chip square>{KIND_LABEL[o.kind] ?? o.kind}</Chip>
        {o.career_track === "direct" && <Chip tone="brand">Hiring</Chip>}
      </div>
      <div className="tiercell">
        <TierBadge tier={o.tier} />
      </div>
      <div className="prizecell">
        <div className={formatPrize(o) === "—" ? "prize none" : "prize"}>{formatPrize(o)}</div>
      </div>
      <div className="confcell">
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
