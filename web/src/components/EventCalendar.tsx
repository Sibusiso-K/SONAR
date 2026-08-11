import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Opportunity } from "@/lib/sonar-types";
import { cn } from "@/lib/utils";

/** Priority = tier. Deliberately its own palette, distinct from the
 * days-remaining severity colours used on the Board rows, so "closes soon"
 * and "matters most" don't get visually conflated. */
const TIER_COLOR: Record<number, string> = {
  1: "var(--accent)",
  2: "var(--warning)",
  3: "var(--unknown)",
};

function tierColor(tier: number | null | undefined) {
  return TIER_COLOR[tier ?? 3] ?? TIER_COLOR[3];
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Monday-first 6-week grid so every month renders at a fixed height. */
function buildGrid(monthStart: Date) {
  const firstWeekday = (monthStart.getDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function EventCalendar({ opportunities }: { opportunities: Opportunity[] }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => startOfMonth(today));

  const byDay = useMemo(() => {
    const map = new Map<string, Opportunity[]>();
    for (const o of opportunities) {
      if (!o.next_date) continue;
      const key = o.next_date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.tier ?? 3) - (b.tier ?? 3));
    }
    return map;
  }, [opportunities]);

  const days = useMemo(() => buildGrid(cursor), [cursor]);

  return (
    <div className="paper-panel">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="font-display text-xl font-bold">{monthLabel(cursor)}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
            }
            className="flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(today))}
            className="label-caps px-2 py-1.5 transition-colors hover:text-foreground"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
            }
            className="flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((w) => (
          <div key={w} className="label-caps px-2 py-2 text-center">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = d.toISOString().slice(0, 10);
          const events = byDay.get(key) ?? [];
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = isSameDay(d, today);

          return (
            <div
              key={key}
              className={cn(
                "min-h-[6.5rem] border-b border-r border-border p-1.5 last:border-r-0",
                (i + 1) % 7 === 0 && "border-r-0",
                !inMonth && "bg-muted/30",
              )}
            >
              <div
                className={cn(
                  "numeral text-xs",
                  inMonth ? "text-foreground" : "text-muted-foreground/50",
                  isToday && "flex size-5 items-center justify-center rounded-full bg-foreground text-background",
                )}
              >
                {d.getDate()}
              </div>
              <div className="mt-1 space-y-1">
                {events.slice(0, 3).map((o) => (
                  <div
                    key={o.id}
                    title={`${o.name} · Tier ${o.tier} · ${o.confidence}`}
                    className={cn(
                      "truncate rounded-sm border-l-2 bg-card px-1 py-0.5 font-mono text-[10px] leading-tight",
                      o.confidence !== "confirmed" && "border-dashed opacity-75",
                    )}
                    style={{ borderColor: tierColor(o.tier) }}
                  >
                    {o.name}
                  </div>
                ))}
                {events.length > 3 && (
                  <div className="label-caps px-1">+{events.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-5 py-3">
        <span className="label-caps">Priority</span>
        {[1, 2, 3].map((t) => (
          <span key={t} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: TIER_COLOR[t] }}
              aria-hidden
            />
            Tier {t}
          </span>
        ))}
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span className="h-0 w-3 border-t-2 border-dashed border-muted-foreground" aria-hidden />
          not yet confirmed
        </span>
      </div>
    </div>
  );
}
