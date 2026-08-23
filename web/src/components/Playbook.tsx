import { useMemo, useState } from "react";
import { Reveal } from "@/components/Reveal";
import {
  ARENA_LABEL,
  BENCHMARK,
  PHASE_LABEL,
  PLAYBOOK,
  gapToLeaderPct,
  shippedVsLeaderPct,
  type Arena,
  type Phase,
} from "@/lib/playbook";
import { cn } from "@/lib/utils";

const PHASES: Phase[] = ["before", "during", "after"];
const ARENAS: (Arena | "all")[] = ["all", "scored", "judged"];

const ARENA_FILTER_LABEL: Record<Arena | "all", string> = {
  all: "everything",
  scored: "leaderboard-scored",
  judged: "judged / pitched",
  both: "both",
};

function groupThousands(n: number) {
  // Locale-independent on purpose: toLocaleString renders differently on the
  // server and the client and React flags the whole subtree as a hydration
  // mismatch. Same fix as the prize breakdown elsewhere in this app.
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function Playbook() {
  const [arena, setArena] = useState<Arena | "all">("all");

  const visible = useMemo(
    () => PLAYBOOK.filter((e) => arena === "all" || e.arena === arena || e.arena === "both"),
    [arena],
  );

  return (
    <section id="playbook" className="mx-auto max-w-[88rem] scroll-mt-24 px-5 pt-24 md:px-10">
      <Reveal>
        <p className="label-caps">The playbook</p>
        <h2 className="display-lg mt-3 max-w-[18ch]">How these actually get won.</h2>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Researched rather than assumed, and split by phase and by arena, because a
          leaderboard-scored contest and a judged pitch event reward different behaviour. Advice
          that blends them is wrong for both. Every claim names its source; the ones marked{" "}
          <span style={{ color: "var(--accent)" }}>ours</span> are things this team measured itself.
        </p>
      </Reveal>

      {/* ---- our own baseline ---- */}
      <Reveal delay={80}>
        <div className="paper-panel mt-10 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="label-caps">Our measured baseline</p>
              <h3 className="mt-2 text-xl font-bold">{BENCHMARK.event}</h3>
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
                <div className="mt-0.5 font-mono text-sm tabular-nums">
                  {groupThousands(l.score)}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Losing on the last few percent is a tuning problem, not a capability problem. The rank
            is the last standing we observed before Entelect closed the leaderboard: the portal
            keeps no score history, so it is recorded as unconfirmed rather than dressed up as a
            final result.
          </p>
        </div>
      </Reveal>

      {/* ---- arena filter ---- */}
      <Reveal delay={120}>
        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-rule pb-3">
          <span className="label-caps">Show</span>
          {ARENAS.map((a) => (
            <button
              key={a}
              onClick={() => setArena(a)}
              className={cn(
                "font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
                arena === a
                  ? "text-foreground underline underline-offset-4"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ARENA_FILTER_LABEL[a]}
            </button>
          ))}
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {visible.length} of {PLAYBOOK.length}
          </span>
        </div>
      </Reveal>

      {/* ---- phases ---- */}
      <div className="mt-10 grid gap-px bg-rule lg:grid-cols-3">
        {PHASES.map((phase) => {
          const entries = visible.filter((e) => e.phase === phase);
          return (
            <div key={phase} className="bg-paper p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-2xl font-bold">{PHASE_LABEL[phase]}</h3>
                <span className="label-caps">{entries.length}</span>
              </div>

              <div className="mt-5 space-y-7">
                {entries.map((e) => (
                  <article key={e.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="border px-1.5 py-px font-mono text-[10px] uppercase tracking-widest"
                        style={
                          e.evidence === "ours"
                            ? { borderColor: "var(--accent)", color: "var(--accent)" }
                            : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                        }
                      >
                        {e.evidence === "ours" ? "ours" : "external"}
                      </span>
                      <span className="label-caps">{ARENA_LABEL[e.arena]}</span>
                    </div>

                    <h4 className="mt-2 text-base font-bold leading-snug">{e.claim}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.detail}</p>
                    <a
                      href={e.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block font-mono text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      {e.source}
                    </a>
                  </article>
                ))}

                {entries.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nothing recorded for this phase under that filter.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
