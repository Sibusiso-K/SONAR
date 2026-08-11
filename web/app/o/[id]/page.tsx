import Link from "next/link";
import { notFound } from "next/navigation";
import {
  KIND_LABEL,
  dateLabel,
  describeLink,
  formatDate,
  formatPrize,
  getOpportunity,
  meta,
  opportunityIds,
  prettyLabel,
  primaryUrl,
  toneFor,
} from "@/lib/data";
import { Chip, ConfidenceChip, TierBadge } from "@/components/ui";

export function generateStaticParams() {
  return opportunityIds().map((id) => ({ id }));
}

const DATE_ORDER = [
  "registration_opens",
  "registration_deadline",
  "application_deadline",
  "entry_deadline",
  "virtual_event",
  "hackathon_start",
  "event_start",
  "event_end",
  "submission_deadline",
  "submission_deadline_sast",
  "final_submission",
  "judging",
  "winners_announced",
];

function orderedDates(dates: Record<string, string | null | undefined>) {
  const entries = Object.entries(dates).filter(
    ([k, v]) => k !== "confidence" && k !== "note" && typeof v === "string"
  );
  return entries.sort(([a], [b]) => {
    const ia = DATE_ORDER.indexOf(a);
    const ib = DATE_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

function breakdownRows(bd: unknown): Array<[string, string]> {
  if (!bd) return [];
  if (Array.isArray(bd)) {
    return bd.map((r) => {
      const o = r as Record<string, unknown>;
      return [String(o.place ?? o.name ?? "—"), String(o.amount ?? "—")];
    });
  }
  if (typeof bd === "object") {
    return Object.entries(bd as Record<string, unknown>).map(([k, v]) => [
      prettyLabel(k),
      typeof v === "number" ? v.toLocaleString("en-ZA") : String(v),
    ]);
  }
  return [];
}

export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const o = getOpportunity(id);
  if (!o) notFound();

  const tone = toneFor(o.days_remaining);
  const weights = meta().scoring_weights ?? {};
  const dates = orderedDates(o.dates ?? {});
  const rows = breakdownRows(o.prize?.breakdown);
  const primaryLink = primaryUrl(o.links);

  return (
    <main className="page">
      <Link href="/" className="back">
        ← Board
      </Link>

      <div className="page-head" style={{ alignItems: "flex-start", marginBottom: 26 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
            <Chip square>{KIND_LABEL[o.kind] ?? o.kind}</Chip>
            <Chip square>{prettyLabel(o.scope)}</Chip>
            {o.format && <Chip square>{prettyLabel(o.format)}</Chip>}
            {o.career_track === "direct" && <Chip tone="brand">Direct hiring route</Chip>}
            <ConfidenceChip c={o.confidence} />
          </div>
          <h1 className="title" style={{ fontSize: 27, lineHeight: 1.2 }}>
            {o.name}
          </h1>
          <p className="subtitle">
            {o.organiser}
            {o.location ? ` · ${o.location}` : ""}
          </p>
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "center", flex: "none" }}>
          <div style={{ textAlign: "right" }}>
            <div
              className="num"
              style={{
                fontSize: 34,
                fontWeight: 600,
                letterSpacing: "-.03em",
                lineHeight: 1,
                color:
                  tone === "critical"
                    ? "var(--critical)"
                    : tone === "warning"
                      ? "var(--warning)"
                      : "var(--text)",
              }}
            >
              {o.days_remaining !== null && o.days_remaining >= 0 ? `${o.days_remaining}d` : "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {o.next_date_label ? prettyLabel(o.next_date_label) : "no confirmed date"}
            </div>
          </div>
          <TierBadge tier={o.tier} />
        </div>
      </div>

      <div className="detail">
        {/* ------------------------------------------------ main column */}
        <div>
          {o.what_to_build && (
            <div className="card">
              <h3>What to build</h3>
              <p>{o.what_to_build}</p>
            </div>
          )}

          {o.deliverables && o.deliverables.length > 0 && (
            <div className="card">
              <h3>Deliverables</h3>
              <ul className="blist">
                {o.deliverables.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {o.scoring_formula && (
            <div className="card">
              <h3>How it&rsquo;s judged</h3>
              <div className="formula">{o.scoring_formula}</div>
            </div>
          )}

          {o.eligibility && (
            <div className="card">
              <h3>Eligibility</h3>
              <p>{o.eligibility}</p>
            </div>
          )}

          {o.team_fit && (
            <div className="card">
              <h3>Team fit</h3>
              <p>{o.team_fit}</p>
            </div>
          )}

          {o.notes && (
            <div className="card">
              <h3>Notes</h3>
              <p>{o.notes}</p>
            </div>
          )}

          {o.dates?.note && (
            <div className="card">
              <h3>Date note</h3>
              <p>{o.dates.note}</p>
            </div>
          )}
        </div>

        {/* ------------------------------------------------ rail */}
        <aside className="rail">
          {primaryLink && (
            <a href={primaryLink} target="_blank" rel="noreferrer" className="cta">
              Open official page ↗
            </a>
          )}

          <div className="card" style={{ marginTop: 14 }}>
            <h3>Dates</h3>
            {dates.length > 0 ? (
              <div className="dl">
                {dates.map(([k, v]) => (
                  <div className="dline" key={k}>
                    <span className="dk" style={k.endsWith("_sast") ? { color: "var(--muted)" } : undefined}>
                      {dateLabel(k)}
                    </span>
                    <span className="dv">{formatDate(v as string)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13.5, color: "var(--muted)", margin: 0 }}>
                No dates confirmed yet. This is why it sits on Radar.
              </p>
            )}
          </div>

          <div className="card">
            <h3>Prize</h3>
            <div className="kv">
              <span className="k">Total pool</span>
              <span className="v num">{formatPrize(o)}</span>
            </div>
            {rows.map(([k, v]) => (
              <div className="kv" key={k}>
                <span className="k">{k}</span>
                <span className="v num">{v}</span>
              </div>
            ))}
            {typeof o.prize?.non_cash === "string" && (
              <div className="kv">
                <span className="k">Non-cash</span>
                <span className="v" style={{ fontWeight: 450, fontSize: 13 }}>
                  {o.prize.non_cash}
                </span>
              </div>
            )}
          </div>

          {o.scores && Object.values(o.scores).some((v) => typeof v === "number") && (
            <div className="card">
              <h3>Score {o.score !== null ? `· ${o.score}` : ""}</h3>
              {Object.entries(o.scores)
                .filter(([, v]) => typeof v === "number")
                .map(([k, v]) => (
                  <div className="sc" key={k}>
                    <span className="sl">
                      {prettyLabel(k)}
                      {weights[k] ? (
                        <span style={{ color: "var(--faint)", fontSize: 11.5 }}>
                          {" "}
                          {Math.round(weights[k] * 100)}%
                        </span>
                      ) : null}
                    </span>
                    <span className="sb">
                      <span className="sf" style={{ width: `${((v as number) / 10) * 100}%` }} />
                    </span>
                    <span className="sv">{v}</span>
                  </div>
                ))}
            </div>
          )}

          {o.links && Object.keys(o.links).length > 0 && (
            <div className="card">
              <h3>Sources</h3>
              {Object.entries(o.links).map(([k, v]) => {
                const l = describeLink(v);
                return (
                  <div className="linkrow" key={k}>
                    <span className="lk">{prettyLabel(k)}</span>
                    <a
                      href={l.href}
                      title={v}
                      {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    >
                      {l.label}
                      {l.external ? " ↗" : ""}
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card">
            <h3>Status</h3>
            <div className="kv">
              <span className="k">Competition</span>
              <span className="v">{prettyLabel(o.status)}</span>
            </div>
            <div className="kv">
              <span className="k">Our stage</span>
              <span className="v">{prettyLabel(o.lifecycle)}</span>
            </div>
            <div className="kv">
              <span className="k">Confidence</span>
              <span className="v">
                <ConfidenceChip c={o.confidence} />
              </span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
