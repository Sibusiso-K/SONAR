import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { formatMoney, zar } from "@/lib/analytics";
import { formatDay } from "@/lib/assistant.builtin";
import {
  FIELD_WEEKS,
  URGENCY_COLOR,
  arcPoints,
  deadlineField,
  totals,
  type Dated,
} from "@/lib/board-view";
import { participationBadge } from "@/lib/participation";
import type { Opportunity, PastOpportunity, UpdateRow } from "@/lib/sonar-types";
import { cn } from "@/lib/utils";

/** "Sibusiso K" -> "SK"; "Lethabo" -> "LE". */
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return (
    parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : name.slice(0, 2)
  ).toUpperCase();
};

const shortDay = (key: string) => formatDay(key).replace(/ \d{4}$/, "");
const inDays = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`);

/* ---------------- next-up stack ---------------- */

/** The three nearest dated rows as a fanned stack, nearest in front. */
export function NextUp({ items, undated }: { items: Dated[]; undated: number }) {
  const [front, left, right] = items;
  if (!front) {
    return (
      <div className="glass-card p-6 text-sm text-muted-foreground">
        No live row has an upcoming date on record. {undated} have no date at all, which is the
        first thing to fix.
      </div>
    );
  }
  const side = (d: Dated, cls: string, tone: string) => (
    <Link
      to="/o/$id"
      params={{ id: d.o.id }}
      className={cn(
        "stack-card hidden h-32 min-w-0 flex-[0_1_15rem] flex-col gap-1 rounded-t-[1.25rem] border border-b-0 border-glass-edge p-4 sm:flex",
        cls,
        tone,
      )}
    >
      <span className="label-caps">
        {shortDay(d.o.next_date!)} · {inDays(d.days)}
      </span>
      <span className="line-clamp-2 text-sm font-semibold">{d.o.name}</span>
      <span className="text-xs text-muted-foreground">{participationBadge(d.o.status).label}</span>
    </Link>
  );
  const hot = front.days <= 7;
  return (
    <div className="stack flex items-end justify-center" data-testid="next-up">
      {left && side(left, "stack-l -mr-6 pr-10", "bg-glass-strong")}
      <Link
        to="/o/$id"
        params={{ id: front.o.id }}
        className="ink-panel stack-card relative z-10 flex h-48 min-w-0 flex-[0_1_21rem] flex-col overflow-hidden rounded-b-none p-5 shadow-2xl"
      >
        {hot && (
          <>
            <span
              aria-hidden="true"
              className="ping-ring absolute right-6 top-6 size-3.5 rounded-full border-2 border-critical motion-safe:animate-[ping-ring_2.2s_cubic-bezier(.2,.6,.3,1)_infinite]"
            />
            <span
              aria-hidden="true"
              className="absolute right-[1.625rem] top-[1.625rem] size-2.5 rounded-full bg-critical"
            />
          </>
        )}
        <span className="label-caps" style={{ color: "var(--ink-panel-muted)" }}>
          Closes {inDays(front.days)} · {front.o.confidence}
        </span>
        <span className="mt-2 line-clamp-2 font-display text-xl font-bold leading-tight">
          {front.o.name}
        </span>
        <span className="mt-1 truncate text-[13px]" style={{ color: "var(--ink-panel-muted)" }}>
          {front.o.organiser}
        </span>
        <span className="mt-auto flex items-baseline justify-between">
          <span className="font-display text-3xl font-extrabold tracking-tight">
            {shortDay(front.o.next_date!)}
          </span>
          <span className="font-mono text-xs" style={{ color: "var(--ink-panel-muted)" }}>
            {participationBadge(front.o.status).label}
          </span>
        </span>
      </Link>
      {right && side(right, "stack-r -ml-6 pl-10", "bg-accent/15")}
    </div>
  );
}

/* ---------------- totals strip ---------------- */

export function Totals({ live, past }: { live: Opportunity[]; past: PastOpportunity[] }) {
  const t = totals(live, past);
  const cells: [string, string, string, string][] = [
    [
      "Live opportunities",
      String(t.live),
      "",
      `${t.tiers[0]} tier 1 · ${t.tiers[1]} tier 2 · ${t.tiers[2]} tier 3`,
    ],
    ["Tracked prize pools", zar(t.poolZar), "", "whole-event totals, converted"],
    ["Calendar-safe", String(t.confirmed), ` of ${t.live}`, "confirmed at source"],
    [
      "Season so far",
      String(t.placed),
      ` placed of ${t.entered}`,
      t.best ? `best: ${t.best}` : "no placement yet",
    ],
  ];
  return (
    <div className="grid grid-cols-2 gap-y-5 lg:grid-cols-4" data-testid="totals">
      {cells.map(([label, big, small, note]) => (
        <div key={label} className="border-l border-border px-4">
          <p className="text-[13px] text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-[1.75rem] font-bold tracking-tight">
            {big}
            <span className="text-muted-foreground/70">{small}</span>
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{note}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------- deadline field ---------------- */

const ROW_H = 44;

/** Every dated row as a bubble: across by date, down by kind, sized by score,
 * coloured by urgency. The right-hand column counts what has no date. */
export function DeadlineField({ live }: { live: Opportunity[] }) {
  const field = deadlineField(live);
  const [picked, setPicked] = useState<string | null>(null);
  const sel = field.bubbles.find((b) => b.o.id === picked);
  const height = field.rows.length * ROW_H + 34;
  const x = (f: number) => `calc(8.25rem + (100% - 12.25rem) * ${f})`;
  const undated = field.rows.reduce((n, r) => n + r.undated, 0);

  return (
    <section aria-label="Deadline field" className="glass-card flex min-w-0 flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Deadline field</h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          next {FIELD_WEEKS} weeks
        </span>
      </div>
      <div className="text-center" aria-live="polite">
        <p className="truncate text-[13px] text-muted-foreground">
          {sel ? sel.o.name : "Dated deadlines ahead"}
        </p>
        <p className="font-display text-4xl font-bold tracking-tight">
          {sel ? shortDay(sel.o.next_date!) : field.dated}
          <span className="text-muted-foreground/70">
            {sel ? ` · ${sel.days}d` : ` of ${live.length}`}
          </span>
        </p>
        <p className="min-h-5 text-[13px] text-muted-foreground">
          {sel ? (
            <Link to="/o/$id" params={{ id: sel.o.id }} className="underline underline-offset-2">
              {sel.o.confidence} · {participationBadge(sel.o.status).label} · open the row
            </Link>
          ) : (
            `${undated} live rows have no upcoming date on record.`
          )}
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="relative min-w-[30rem]" style={{ height }}>
          {field.rows.map((r, i) => (
            <div key={r.kind}>
              <span
                className="absolute left-0 w-32 -translate-y-1/2 truncate text-xs text-muted-foreground first-letter:uppercase"
                style={{ top: i * ROW_H + ROW_H / 2 }}
              >
                {r.label}
              </span>
              <span
                aria-hidden="true"
                className="absolute h-px bg-border"
                style={{ left: "8.25rem", right: "4rem", top: i * ROW_H + ROW_H / 2 }}
              />
              <span
                className="absolute right-0 w-14 -translate-y-1/2 text-right font-mono text-[11px] text-muted-foreground"
                style={{ top: i * ROW_H + ROW_H / 2 }}
              >
                {r.undated}
              </span>
            </div>
          ))}
          {[0, 4, 8, 12, 16].map((w) => (
            <span
              key={w}
              className="absolute bottom-0 -translate-x-1/2 font-mono text-[11px] text-muted-foreground"
              style={{ left: x(w / FIELD_WEEKS) }}
            >
              {w === 0 ? "now" : `+${w}w`}
            </span>
          ))}
          <span className="absolute bottom-0 right-0 w-14 text-right font-mono text-[11px] text-muted-foreground">
            no date
          </span>
          {field.bubbles.map((b, i) => (
            <button
              key={b.o.id}
              type="button"
              aria-label={`${b.o.name}, ${shortDay(b.o.next_date!)}, ${inDays(b.days)}`}
              aria-pressed={picked === b.o.id}
              onClick={() => setPicked(picked === b.o.id ? null : b.o.id)}
              className="bubble-pop absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center motion-safe:animate-[bubble-pop_.5s_cubic-bezier(.16,1,.3,1)_both]"
              style={{
                left: x(b.x),
                top: b.row * ROW_H + ROW_H / 2,
                animationDelay: `${200 + i * 70}ms`,
              }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block rounded-full shadow-md transition-shadow",
                  picked === b.o.id &&
                    "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
                style={{ width: b.size, height: b.size, backgroundColor: URGENCY_COLOR[b.urgency] }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-foreground/5 px-3.5 py-2.5 text-xs text-muted-foreground">
        <span>
          Size: <strong className="font-semibold text-foreground">board score</strong>
        </span>
        {(
          [
            ["critical", "within 7 days"],
            ["warning", "within 21"],
            ["later", "later"],
          ] as const
        ).map(([u, label]) => (
          <span key={u} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: URGENCY_COLOR[u] }}
            />
            {label}
          </span>
        ))}
        {field.beyond > 0 && <span>{field.beyond} dated beyond this window</span>}
      </div>
    </section>
  );
}

/* ---------------- confidence arc ---------------- */

export function ConfidenceArc({ live }: { live: Opportunity[] }) {
  const t = totals(live, []);
  const pts = arcPoints(live.length, 92);
  const kindOf = (i: number) => (i < t.confirmed ? 0 : i < t.confirmed + t.reported ? 1 : 2);
  return (
    <section
      aria-label="Date confidence"
      className="glass-card flex min-w-0 flex-1 basis-52 flex-col gap-2 p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Confidence</h2>
        <Link to="/stats" aria-label="Open stats" className="grid size-11 place-items-center">
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <div
        role="img"
        aria-label={`${t.confirmed} confirmed, ${t.reported} reported, ${t.shaky} not calendar-safe, of ${t.live} live rows`}
        className="relative mx-auto h-32 w-56"
      >
        {pts.map((p, i) => {
          const k = kindOf(i);
          return (
            <span
              key={i}
              className={cn(
                "absolute rounded-full",
                k === 0 && "size-[11px] bg-foreground",
                k === 1 && "size-[11px] bg-accent",
                k === 2 && "size-[9px] ring-[1.5px] ring-inset ring-muted-foreground",
              )}
              style={{ left: 112 + p.x, top: 104 + p.y, transform: "translate(-50%,-50%)" }}
            />
          );
        })}
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="label-caps">Calendar-safe</p>
          <p className="font-display text-2xl font-bold tracking-tight">
            {t.confirmed}
            <span className="text-muted-foreground/70">/{t.live}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{t.confirmed} confirmed</span>
        <span className="text-accent">{t.reported} reported</span>
        <span>{t.shaky} unconfirmed</span>
      </div>
    </section>
  );
}

/* ---------------- radar preview ---------------- */

export function RadarCard({ live }: { live: Opportunity[] }) {
  const count = (scope: string) => live.filter((o) => o.scope === scope).length;
  return (
    <Link
      to="/radar"
      aria-label="Open the radar: globe and score space"
      className="ink-panel relative flex min-w-0 flex-1 basis-52 flex-col gap-2 overflow-hidden p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Radar</h2>
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </div>
      <div aria-hidden="true" className="relative mx-auto my-1 size-36">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_34%_30%,#3C4E86_0%,#232B49_55%,#171A2B_100%)] shadow-[0_0_40px_rgba(126,156,255,.2)]" />
        <div className="absolute inset-0 rounded-full bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.1)_0_1px,transparent_1px_18px),repeating-linear-gradient(90deg,rgba(255,255,255,.07)_0_1px,transparent_1px_18px)]" />
        <span className="ping-ring absolute left-[56%] top-[62%] size-2.5 rounded-full border border-critical motion-safe:animate-[ping-ring_2.2s_infinite]" />
        <span className="absolute left-[56%] top-[62%] size-2.5 rounded-full bg-critical" />
        <span className="absolute left-[40%] top-[34%] size-1.5 rounded-full bg-white" />
        <span className="absolute left-[68%] top-[28%] size-1.5 rounded-full bg-[#7E9CFF]" />
      </div>
      <p className="text-xs" style={{ color: "var(--ink-panel-muted)" }}>
        {count("local")} local · {count("continental")} continental · {count("international")}{" "}
        international
      </p>
    </Link>
  );
}

/* ---------------- recent updates ---------------- */

export function RecentUpdates({ updates }: { updates: UpdateRow[] }) {
  const recent = updates.filter((u) => u.change_kind !== "sync").slice(0, 5);
  return (
    <section
      aria-label="Recent updates"
      className="glass-card flex min-w-0 flex-col gap-1.5 p-5 pb-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Updates</h2>
        <Link to="/updates" className="flex min-h-11 items-center text-[13px] font-semibold">
          View all
        </Link>
      </div>
      {recent.length === 0 && (
        <p className="pb-3 text-sm text-muted-foreground">Nothing on the audit trail yet.</p>
      )}
      {recent.map((u) => (
        <div
          key={u.id}
          className="flex items-center gap-3 rounded-2xl border border-border bg-glass-strong px-3.5 py-3"
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/5 font-mono text-[11px]"
          >
            {u.actor_kind === "human" ? initials(u.actor) : "··"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{u.summary}</p>
            <p className="text-xs text-muted-foreground">
              {u.actor} · {shortDay(u.created_at)}
            </p>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {u.change_kind}
          </span>
        </div>
      ))}
    </section>
  );
}

/** A compact money line for the row cards. */
export function prizeLine(o: Opportunity): string {
  return o.prize?.pool ? formatMoney(o.prize.pool, o.prize.currency) : "no cash pool";
}
