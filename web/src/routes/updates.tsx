import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Reveal, RevealWords } from "@/components/Reveal";
import { useUpdates } from "@/lib/sonar-data";
import { Bot, User } from "lucide-react";

export const Route = createFileRoute("/updates")({
  head: () => ({
    meta: [
      { title: "Updates: the audit trail | SONAR" },
      {
        name: "description",
        content:
          "Append-only log of every change to the board: who or what made it, when, and what it changed.",
      },
      { property: "og:title", content: "Updates: the audit trail | SONAR" },
      {
        property: "og:description",
        content:
          "Every data change on the SONAR board, timestamped and attributed to a person or the verification pipeline.",
      },
    ],
  }),
  component: Updates,
});

const KIND_COLOR: Record<string, string> = {
  correction: "var(--warning)",
  conflict: "var(--critical)",
  stale: "var(--critical)",
  confidence: "var(--stable)",
  discovery: "var(--accent)",
  status: "var(--accent)",
  score: "var(--unknown)",
  watch: "var(--unknown)",
  note: "var(--unknown)",
};

function Updates() {
  const { data: updates = [], isLoading } = useUpdates();

  return (
    <AppShell>
      <section className="mx-auto max-w-[88rem] px-5 pb-12 pt-16 md:px-10 md:pt-24">
        <p className="label-caps">Updates</p>
        <h1 className="display-xl mt-5 max-w-[13ch]">
          <RevealWords text="Nothing changes quietly." />
        </h1>
        <Reveal delay={200}>
          <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground">
            Append-only. {updates.length} entries. Machine changes are attributed to the
            verification pipeline; everything else has a name on it.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[62rem] px-5 md:px-10">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        <ol className="border-l border-rule">
          {updates.map((u, i) => (
            <Reveal
              key={u.id}
              as="li"
              delay={Math.min(i, 8) * 35}
              className="relative block pb-9 pl-7"
            >
              <span
                className="absolute -left-[4.5px] top-1.5 size-[9px] rounded-full"
                style={{ backgroundColor: KIND_COLOR[u.change_kind] ?? "var(--unknown)" }}
                aria-hidden
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <time className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {new Date(u.created_at).toLocaleString("en-ZA", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                <span
                  className="font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: KIND_COLOR[u.change_kind] ?? "var(--unknown)" }}
                >
                  {u.change_kind}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  {u.actor_kind === "human" ? (
                    <User className="size-3" />
                  ) : (
                    <Bot className="size-3" />
                  )}
                  {u.actor}
                </span>
              </div>
              <p className="mt-1.5 text-lg font-bold leading-snug">{u.summary}</p>
              {u.detail && (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {u.detail}
                </p>
              )}
            </Reveal>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
