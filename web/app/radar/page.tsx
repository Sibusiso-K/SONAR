import { CONFIDENCE_LABEL, past, radarOpportunities, sources } from "@/lib/data";
import { Board } from "@/components/ui";

export default function RadarPage() {
  const radar = radarOpportunities();
  const missed = past();
  const srcs = sources();

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

      <Board items={radar} />

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
              data-tone={p.missed ? "critical" : undefined}
              style={{ flex: "none" }}
            >
              {p.missed ? "Missed" : "Past"}
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
