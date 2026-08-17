import { useEffect, useState } from "react";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function partsUntil(target: Date, now: Date): Parts | null {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const totalSeconds = Math.floor(diffMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * A real ticking countdown to a deadline, not a static "days left" number
 * frozen at page load. `date` is a bare YYYY-MM-DD (next_date has no time
 * component on this board); the deadline is treated as end-of-day since
 * that is the honest reading of a date-only field.
 *
 * `now` starts null and is only set client-side: `new Date()` differs
 * between the server's render and the client's, and rendering that
 * directly would be a hydration mismatch — same rule as the globe's star
 * field and the radar's angle spacing elsewhere in this app.
 */
export function CountdownClock({ date, color }: { date: string | null; color: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (!date) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [date]);

  if (!date || !now) return null;

  const target = new Date(`${date}T23:59:59`);
  const parts = partsUntil(target, now);
  if (!parts) return null;

  return (
    <p className="mt-1 font-mono text-xs tabular-nums" style={{ color }}>
      {parts.days > 0 && `${parts.days}d `}
      {pad(parts.hours)}:{pad(parts.minutes)}:{pad(parts.seconds)}
    </p>
  );
}
