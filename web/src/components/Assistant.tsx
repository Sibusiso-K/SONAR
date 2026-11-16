import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askSonar } from "@/lib/assistant.functions";
import { fitConversation } from "@/lib/assistant-limits";
import { assistantSuggestions, sourceLabel, type AnswerSource } from "@/lib/assistant-ui";
import { useOpportunities } from "@/lib/sonar-data";
import { cn } from "@/lib/utils";
import { X, CornerDownLeft, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; source?: AnswerSource };

export function Assistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ask = useServerFn(askSonar);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Suggestions name rows that are on the board today. They used to be
  // hardcoded and outlived the entries they mentioned.
  const { data: live } = useOpportunities();
  const suggestions = useMemo(() => assistantSuggestions(live ?? []), [live]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Local display keeps the full conversation; only the network payload is
  // trimmed (see lib/assistant-limits.ts). The server rejects, rather than
  // trims, a request over its count or size ceiling, so a long conversation
  // that was sent whole would fail every later send until a reload. History
  // is fitted to a budget under those ceilings instead.

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await ask({ data: { messages: fitConversation(next) } });
      setMessages([
        ...next,
        "reply" in res && res.reply
          ? {
              role: "assistant",
              content: res.reply,
              source: { provider: res.provider, model: res.model, skipped: res.skipped },
            }
          : { role: "assistant", content: (res as { error: string }).error },
      ]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "That request didn't get through. Try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[30rem] flex-col bg-paper shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:inset-y-3 sm:right-3 sm:rounded-[1.75rem]",
          open ? "translate-x-0" : "translate-x-[110%]",
        )}
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
          <div>
            <h2 className="text-2xl font-bold">Ask the board</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reads the live table. Won't invent a date it can't source.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close assistant"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="label-caps">Try</p>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm transition-colors hover:border-accent hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-5">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex flex-col", m.role === "user" && "items-end")}>
                <div
                  className={cn(
                    "max-w-[92%] whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-[1.25rem_1.25rem_0.375rem_1.25rem] bg-primary text-primary-foreground"
                      : m.source && m.source.provider !== "builtin"
                        ? "rounded-[0.375rem_1.25rem_1.25rem_1.25rem] border border-accent/25 bg-accent/10"
                        : "rounded-[0.375rem_1.25rem_1.25rem_1.25rem] border border-border bg-background",
                  )}
                >
                  {m.content}
                </div>
                {m.source && (
                  <p
                    className="mt-2 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                    data-testid="assistant-source"
                    data-provider={m.source.provider}
                  >
                    {sourceLabel(m.source)}
                  </p>
                )}
              </div>
            ))}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Reading the board…
              </p>
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="p-4 pt-2"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={2}
              placeholder="Ask about priorities, scores, eligibility, clashes…"
              className="min-h-[3.5rem] flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-[3.5rem] items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
            >
              Send <CornerDownLeft className="size-3.5" />
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
