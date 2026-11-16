import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { structureDebrief } from "@/lib/debrief.functions";
import {
  EMPTY_FIELDS,
  MAX_DEBRIEF_CHARS,
  OUTCOMES,
  OUTCOME_LABEL,
  awaitingDebrief,
  dismiss,
  dismissedIds,
  type Debrief,
  type DebriefFields,
  type DebriefOutcome,
} from "@/lib/debrief";
import { useIdentity } from "@/lib/identity";
import { useDebriefs, useFileDebrief, useOpportunities } from "@/lib/sonar-data";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;

/**
 * "This one has passed. How did it go?"
 *
 * Shown once per finished event to whoever has picked their name, until they
 * file a debrief or put it off. Mounted in the shell, so it can appear on any
 * page; `openFor` lets a page open it deliberately (the Crew page's
 * "waiting" cards do).
 */
export function DebriefPrompt() {
  const { identity, hydrated } = useIdentity();
  const { data: live = [] } = useOpportunities();
  // Nothing to ask anyone who has not said who they are, so no read either.
  const { data: debriefs } = useDebriefs({ enabled: Boolean(identity) });
  const file = useFileDebrief();
  const structure = useServerFn(structureDebrief);

  const [openId, setOpenId] = useState<string | null>(null);
  const [snoozed, setSnoozed] = useState(0);
  const [outcome, setOutcome] = useState<DebriefOutcome | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ fields: DebriefFields; by: string } | null>(null);

  const waiting = useMemo(() => {
    if (!identity || !debriefs) return [];
    const now = new Date();
    const handled = new Set([
      ...debriefs.rows.filter((d) => d.filed_by === identity).map((d) => d.opportunity_id),
      ...dismissedIds(window.localStorage, identity, now),
    ]);
    return awaitingDebrief(live, now, handled);
    // `snoozed` re-reads the dismissals after one is written.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, debriefs, live, snoozed]);

  // Open on the most recently finished event, once the splash has gone.
  useEffect(() => {
    if (!hydrated || openId || waiting.length === 0) return;
    const id = window.setTimeout(() => setOpenId(waiting[0]!.o.id), 2600);
    return () => window.clearTimeout(id);
  }, [hydrated, openId, waiting]);

  // Pages can ask for a specific event's debrief.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (typeof id === "string") setOpenId(id);
    };
    window.addEventListener("sonar:debrief", onOpen);
    return () => window.removeEventListener("sonar:debrief", onOpen);
  }, []);

  const current = waiting.find((w) => w.o.id === openId);

  const reset = () => {
    setOpenId(null);
    setOutcome(null);
    setText("");
    setResult(null);
  };

  const putOff = (days: number) => {
    if (identity && current) {
      dismiss(window.localStorage, identity, current.o.id, new Date(Date.now() + days * DAY_MS));
      setSnoozed((n) => n + 1);
    }
    reset();
  };

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && putOff(1);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!identity || !current) return null;
  const { o, daysAgo } = current;
  const needsWords = outcome !== "withdrew" && outcome !== "missed";

  async function sort() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await structure({ data: { eventName: o.name, text: text.trim() } });
      if ("error" in res) toast(res.error);
      else setResult({ fields: res.fields, by: res.structuredBy });
    } catch {
      toast("That didn't get through. Your text is still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!outcome || !identity) return;
    const row: Debrief = {
      ...(result?.fields ?? EMPTY_FIELDS),
      id: crypto.randomUUID(),
      opportunity_id: o.id,
      opportunity_name: o.name,
      filed_by: identity,
      outcome,
      raw_text: text.trim() || OUTCOME_LABEL[outcome],
      structured_by: result?.by ?? "not structured",
      created_at: new Date().toISOString(),
    };
    const where = await file.mutateAsync(row);
    toast(
      where === "database"
        ? "Debrief saved to the evaluation data."
        : "Debrief kept on this device.",
      where === "device"
        ? {
            description:
              "The database did not accept it (the debriefs table may not be set up yet). It will show on this device's Crew page.",
          }
        : undefined,
    );
    reset();
  }

  const canSave = Boolean(outcome) && (!needsWords || !text.trim() || Boolean(result));
  const rows: [string, string | null][] = [
    ["outcome", outcome],
    ["placement", result?.fields.placement ?? null],
    ["hours_spent", result?.fields.hours_spent != null ? String(result.fields.hours_spent) : null],
    ["what_worked", result?.fields.what_worked ?? null],
    ["what_cost_us", result?.fields.what_cost_us ?? null],
    [
      "would_reuse",
      result?.fields.would_reuse.length ? result.fields.would_reuse.join(" · ") : null,
    ],
    ["judge_feedback", result?.fields.judge_feedback ?? null],
  ];

  return (
    <>
      <div
        aria-hidden="true"
        onClick={() => putOff(1)}
        className="fixed inset-0 z-[60] bg-foreground/40 backdrop-blur-[3px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="debrief-title"
        data-testid="debrief"
        className="fixed left-1/2 top-1/2 z-[61] flex max-h-[92dvh] w-[min(60rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-[1.75rem] bg-paper shadow-2xl motion-safe:animate-[dialog-pop_.45s_cubic-bezier(.16,1,.3,1)_both] md:flex-row md:overflow-hidden"
      >
        <div className="flex min-w-0 flex-[1.25] flex-col gap-4 p-6 md:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-caps" style={{ color: "var(--warning)" }}>
                Finished {daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`}
              </p>
              <h2 id="debrief-title" className="mt-2 text-2xl font-bold md:text-[1.75rem]">
                {o.name} has passed. How did it go?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Two minutes now, while it is still true.
              </p>
            </div>
            <button
              onClick={() => putOff(1)}
              aria-label="Close and ask again tomorrow"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground/5"
            >
              <X className="size-4" />
            </button>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">What happened?</legend>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={outcome === id}
                  onClick={() => setOutcome(outcome === id ? null : id)}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                    outcome === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:border-foreground",
                  )}
                >
                  {OUTCOME_LABEL[id]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-1 flex-col gap-2">
            <span className="text-sm font-semibold">In your own words</span>
            <textarea
              value={text}
              maxLength={MAX_DEBRIEF_CHARS}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
              placeholder="Did you submit? What did you build, what worked, what burned the time, what would you reuse? Paste judge feedback exactly as you got it."
              className="min-h-40 flex-1 resize-none rounded-2xl border border-input bg-background p-4 text-sm outline-none focus:border-accent"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void sort()}
              disabled={!text.trim() || busy}
              className="pill bg-primary px-6 text-primary-foreground disabled:opacity-40"
            >
              {busy && <Loader2 className="size-4 animate-spin" />} Structure it
            </button>
            <button type="button" onClick={() => putOff(1)} className="pill border border-input">
              Remind me tomorrow
            </button>
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
              filing as {identity}
            </span>
          </div>
        </div>

        <aside
          aria-label="What gets filed"
          className="flex min-w-0 flex-1 flex-col gap-3 bg-ink-panel p-6 text-ink-panel-foreground md:p-7"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">What gets filed</h3>
            <span className="label-caps" style={{ color: "var(--ink-panel-muted)" }}>
              {result ? result.by.replace(/^[^/]+\//, "").replace(/:free$/, "") : "evaluation"}
            </span>
          </div>
          <p className="text-[13px]" style={{ color: "var(--ink-panel-muted)" }}>
            Your words are sorted into these fields and then checked against what you wrote. A field
            you did not speak to stays empty.
          </p>
          <dl className="font-mono text-xs">
            {rows.map(([k, v]) => (
              <div key={k} className="flex gap-3 border-t border-white/15 py-2.5">
                <dt className="w-28 shrink-0" style={{ color: "var(--ink-panel-muted)" }}>
                  {k}
                </dt>
                <dd className={cn("min-w-0 break-words", !v && "opacity-50")}>
                  {v ??
                    (k === "outcome" ? "pick one" : result ? "not mentioned" : "from your words")}
                </dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave || file.isPending}
            className="mt-auto flex min-h-12 items-center justify-center rounded-full bg-ink-panel-foreground text-sm font-semibold text-ink-panel transition-opacity disabled:opacity-30"
          >
            Save to evaluation
          </button>
        </aside>
      </div>
    </>
  );
}

/** Ask the shell to open the debrief for one event. */
export function openDebrief(id: string) {
  window.dispatchEvent(new CustomEvent("sonar:debrief", { detail: id }));
}
