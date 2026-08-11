import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askSonar } from "@/lib/assistant.functions";
import { cn } from "@/lib/utils";
import { X, CornerDownLeft, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Which opportunity should we prioritise this week?",
  "Why is ARC Prize scored the way it is?",
  "Draft a submission checklist for the Entelect University Cup.",
  "What conflicts or risks do you see in the board right now?",
];

export function Assistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ask = useServerFn(askSonar);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await ask({ data: { messages: next } });
      setMessages([
        ...next,
        {
          role: "assistant",
          content: "reply" in res && res.reply ? res.reply : (res as { error: string }).error,
        },
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
          "fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[30rem] flex-col border-l bg-paper transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <h2 className="text-2xl font-bold">Ask the board</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reads the live table. Won't invent a date it can't source.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close assistant"
            className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="label-caps">Try</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full border border-border bg-background px-4 py-3 text-left text-sm transition-colors hover:border-accent hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-5">
            {messages.map((m, i) => (
              <div key={i}>
                <p className="label-caps mb-1.5">{m.role === "user" ? "You" : "SONAR"}</p>
                <div
                  className={cn(
                    "whitespace-pre-wrap text-sm leading-relaxed",
                    m.role === "user"
                      ? "border-l-2 border-accent pl-3 text-foreground"
                      : "text-foreground",
                  )}
                >
                  {m.content}
                </div>
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
          className="border-t p-4"
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
              className="min-h-[3.5rem] flex-1 resize-none border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-[3.5rem] items-center gap-1.5 bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
            >
              Send <CornerDownLeft className="size-3.5" />
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
