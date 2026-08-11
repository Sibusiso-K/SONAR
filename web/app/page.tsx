import {
  compactUsd,
  liveOpportunities,
  past,
  totalTrackedUsd,
} from "@/lib/data";
import { Alert, FilterableBoard, Tile } from "@/components/ui";
import Link from "next/link";

export default function BoardPage() {
  const live = liveOpportunities();
  const dated = live.filter((o) => o.days_remaining !== null && o.days_remaining >= 0);
  const next = dated[0];
  const closingSoon = dated.filter((o) => (o.days_remaining ?? 99) <= 21);
  const needsVerify = live.filter((o) => o.confidence !== "confirmed");
  const hiring = live.filter((o) => o.career_track === "direct");
  const missed = past().filter((p) => p.missed);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="title">Board</h1>
          <p className="subtitle">
            Everything live, ranked by what closes first. {live.length} opportunities tracked.
          </p>
        </div>
      </div>

      {missed.length > 0 && (
        <Alert head={`${missed[0].name} — missed`}>
          {missed[0].summary} Nothing was watching it.{" "}
          <Link href="/radar/">Why this happened →</Link>
        </Alert>
      )}

      {next && (next.days_remaining ?? 99) <= 7 && (
        <Alert kind="warn" head={`${next.name} closes in ${next.days_remaining} days`}>
          {next.next_date_label ? `${next.next_date_label} · ` : ""}
          <Link href={`/o/${next.id}/`}>Open the brief →</Link>
        </Alert>
      )}

      <div className="tiles">
        <Tile
          label="Next deadline"
          value={next?.days_remaining ?? "—"}
          unit={next ? "d" : undefined}
          meta={next?.name}
          tone={
            (next?.days_remaining ?? 99) <= 7
              ? "critical"
              : (next?.days_remaining ?? 99) <= 21
                ? "warning"
                : undefined
          }
        />
        <Tile
          label="Closing ≤ 21 days"
          value={closingSoon.length}
          meta={`of ${dated.length} with a confirmed date`}
          tone={closingSoon.length > 2 ? "warning" : undefined}
        />
        <Tile
          label="Prize pool tracked"
          value={`$${compactUsd(totalTrackedUsd(live))}`}
          meta="cash only, converted to USD"
        />
        <Tile
          label="Needs verification"
          value={needsVerify.length}
          meta="not yet calendar-safe"
        />
        <Tile
          label="Direct hiring route"
          value={hiring.length}
          meta="the event is the interview"
        />
      </div>

      <FilterableBoard items={live} />

      <p
        className="subtitle"
        style={{ marginTop: 14, display: "flex", gap: 16, flexWrap: "wrap" }}
      >
        <span>
          <strong style={{ color: "var(--critical)" }}>▌</strong> ≤7 days
        </span>
        <span>
          <strong style={{ color: "var(--warning)" }}>▌</strong> ≤21 days
        </span>
        <span>
          <strong style={{ color: "var(--stable)" }}>▌</strong> further out
        </span>
        <span>
          <strong style={{ color: "var(--rule-strong)" }}>▌</strong> no confirmed date
        </span>
      </p>
    </main>
  );
}
