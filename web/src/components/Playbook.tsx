import { useMemo, useState } from "react";
import { Reveal } from "@/components/Reveal";
import { ARENA_LABEL, PHASE_LABEL, PLAYBOOK, type Arena, type Phase } from "@/lib/playbook";
import { cn } from "@/lib/utils";

const PHASES: Phase[] = ["before", "during", "after"];
const ARENAS: (Arena | "all")[] = ["all", "scored", "judged"];

const ARENA_FILTER_LABEL: Record<Arena | "all", string> = {
  all: "everything",
  scored: "leaderboard-scored",
  judged: "judged / pitched",
  both: "both",
};

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

      {/* ---- arena filter ---- */}
      <Reveal delay={80}>
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
