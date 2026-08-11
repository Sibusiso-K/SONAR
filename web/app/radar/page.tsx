import { formatDate, past, radarOpportunities, sources } from "@/lib/data";
import { FilterableBoard } from "@/components/ui";
import predictionsRaw from "@/data/predictions.json";

interface Prediction {
  opportunity_slug: string;
  predicted_announce_start: string;
  predicted_announce_end: string;
  predicted_event_start: string;
  predicted_event_end: string;
  basis: string;
  n_editions: number;
  confidence: number;
}

export default function RadarPage() {
  const radar = radarOpportunities();
  const missed = past();
  const srcs = sources();
  const preds = ((predictionsRaw as { predictions: Prediction[] }).predictions ?? []).sort(
    (a, b) => a.predicted_announce_start.localeCompare(b.predicted_announce_start)
  );

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="title">Radar</h1>
          <p className="subtitle">
            Everything not yet safe to put on a committed calendar — unverified dates, single-source
            claims, and predicted editions.
          </p>
        </div>
      </div>

      <div className="alert warn" style={{ marginBottom: 22 }}>
        <div className="ic">!</div>
        <div className="bd">
          <div className="hd">Do not plan a weekend around anything on this page</div>
          <div className="tx">
            These entries have not cleared the two-source rule. Dates here are indicative. They only
            move to the Board once an organiser page confirms them, or two independent sources agree.
          </div>
        </div>
      </div>

      <FilterableBoard items={radar} />

      <h2 className="title" style={{ fontSize: 18, marginTop: 42, marginBottom: 4 }}>
        Predicted windows
      </h2>
      <p className="subtitle" style={{ marginBottom: 14 }}>
        Forecast from prior editions — when to start watching for next year&rsquo;s
        announcement. These are not dates; they are windows to raise the check
        frequency in. Superseded automatically the moment a real source confirms.
      </p>
      {preds.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-2)" }}>
            No forecasts yet. Prediction needs at least two prior editions of the same
            opportunity. Backfill the <code style={{ fontFamily: "var(--mono)" }}>editions</code>{" "}
            table — Gradhack, FNB App of the Year, Geekulcha, Huawei and Entelect all recur —
            then run{" "}
            <code style={{ fontFamily: "var(--mono)" }}>python3 scripts/sonar_db.py forecast</code>.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {preds.map((p, i) => (
            <div
              key={p.opportunity_slug}
              style={{
                padding: "13px 18px",
                borderBottom: i === preds.length - 1 ? "none" : "1px solid var(--rule)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontWeight: 570, fontSize: 14.5 }}>{p.opportunity_slug}</span>
                <span className="chip">
                  {Math.round(p.confidence * 100)}% · {p.n_editions} editions
                </span>
              </div>
              <div className="dline" style={{ borderBottom: "none", padding: "3px 0" }}>
                <span className="dk">Start watching</span>
                <span className="dv">
                  {formatDate(p.predicted_announce_start)} – {formatDate(p.predicted_announce_end)}
                </span>
              </div>
              <div className="dline" style={{ borderBottom: "none", padding: "3px 0" }}>
                <span className="dk">Event likely</span>
                <span className="dv">
                  {formatDate(p.predicted_event_start)} – {formatDate(p.predicted_event_end)}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 5 }}>{p.basis}</div>
            </div>
          ))}
        </div>
      )}

      <h2 className="title" style={{ fontSize: 18, marginTop: 42, marginBottom: 4 }}>
        Past &amp; missed
      </h2>
      <p className="subtitle" style={{ marginBottom: 14 }}>
        Kept deliberately. Prior editions are what let the pipeline predict next year&rsquo;s window.
      </p>
      <div className="card" style={{ padding: 0 }}>
        {missed.map((p, i) => (
          <div
            key={p.name}
            style={{
              display: "flex",
              gap: 14,
              padding: "13px 18px",
              borderBottom: i === missed.length - 1 ? "none" : "1px solid var(--rule)",
              alignItems: "baseline",
            }}
          >
            <span
              className="chip"
              data-tone={p.missed ? "critical" : p.result ? "stable" : undefined}
              style={{ flex: "none" }}
            >
              {p.missed ? "Missed" : p.result ?? "Past"}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 560, fontSize: 14.5, marginBottom: 2 }}>
                {p.link ? (
                  <a href={p.link} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>
                    {p.name}
                  </a>
                ) : (
                  p.name
                )}
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.55 }}>
                {p.reason}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="title" style={{ fontSize: 18, marginTop: 42, marginBottom: 4 }}>
        Monitored sources
      </h2>
      <p className="subtitle" style={{ marginBottom: 14 }}>
        {srcs.length} feeds on a schedule. The pipeline sweeps these; anything new lands on Radar
        first.
      </p>
      <div className="card" style={{ padding: 0 }}>
        {srcs.map((s, i) => (
          <div
            key={s.url}
            className="linkrow"
            style={{
              padding: "11px 18px",
              borderBottom: i === srcs.length - 1 ? "none" : "1px solid var(--rule)",
            }}
          >
            <span className="lk" style={{ color: "var(--text)", fontWeight: 540 }}>
              {s.name}
            </span>
            <span style={{ display: "flex", gap: 12, alignItems: "baseline", minWidth: 0 }}>
              {s.note && (
                <span style={{ color: "var(--faint)", fontSize: 12.5 }}>{s.note}</span>
              )}
              <span className="chip sq" style={{ flex: "none" }}>
                {s.cadence}
              </span>
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
