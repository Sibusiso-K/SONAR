import { BENCHMARK, gapToLeaderPct, shippedVsLeaderPct } from "@/lib/playbook";

function groupThousands(n: number) {
  // Locale-independent on purpose: toLocaleString renders differently on the
  // server and the client and React flags the whole subtree as a hydration
  // mismatch. Same fix as the prize breakdown elsewhere in this app.
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * The one competition we have hard numbers for, rendered as a calibration
 * point rather than a trophy. Lives on /stats because it is the only real
 * outcome the rest of that page's modelling can be checked against.
 */
export function CompetitionBaseline() {
  return (
    <div className="paper-panel p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h3 className="text-xl font-bold">{BENCHMARK.event}</h3>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{BENCHMARK.date}</p>
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <div className="numeral text-3xl" style={{ color: "var(--accent)" }}>
              {gapToLeaderPct()}%
            </div>
            <div className="label-caps mt-1">behind the leader</div>
          </div>
          <div>
            <div className="numeral text-3xl">{shippedVsLeaderPct()}%</div>
            <div className="label-caps mt-1">of the winning score</div>
          </div>
          <div>
            <div className="numeral text-3xl">{BENCHMARK.standing}</div>
            <div className="label-caps mt-1" style={{ color: "var(--warning)" }}>
              {BENCHMARK.standingConfirmed ? "confirmed" : "unconfirmed"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-px bg-rule sm:grid-cols-4">
        {BENCHMARK.levels.map((l) => (
          <div key={l.level} className="bg-paper px-4 py-3">
            <div className="label-caps">level {l.level}</div>
            <div className="mt-0.5 font-mono text-sm tabular-nums">{groupThousands(l.score)}</div>
          </div>
        ))}
      </div>

      <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Losing on the last few percent is a tuning problem, not a capability problem. The rank is
        the last standing we observed before Entelect closed the leaderboard: the portal keeps no
        score history, so it is recorded as unconfirmed rather than dressed up as a final result.
      </p>
    </div>
  );
}
