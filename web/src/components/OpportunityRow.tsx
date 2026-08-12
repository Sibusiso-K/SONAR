import { Star } from "lucide-react";
import { OrgLogo } from "@/components/OrgLogo";
import { WinRing } from "@/components/WinRing";
import {
  daysUntil,
  expectedValueUsd,
  formatMoney,
  severityOf,
  severityToken,
  usd,
  winProbability,
} from "@/lib/analytics";
import type { Opportunity, WatchRow } from "@/lib/sonar-types";
import { useIdentity } from "@/lib/identity";
import { useToggleWatch } from "@/lib/sonar-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CONFIDENCE_COPY: Record<string, string> = {
  confirmed: "confirmed",
  reported: "reported only",
  unconfirmed: "unconfirmed",
  predicted: "predicted",
  conflicted: "sources disagree",
};

export function OpportunityRow({
  o,
  watchers,
  index,
}: {
  o: Opportunity;
  watchers: WatchRow[];
  index: number;
}) {
  const { identity } = useIdentity();
  const toggle = useToggleWatch();
  const sev = severityOf(o);
  const d = daysUntil(o.next_date);
  const wp = winProbability(o);
  const mine = identity ? watchers.some((w) => w.watched_by === identity) : false;

  return (
    <article
      id={`opp-${o.id}`}
      className="group relative grid scroll-mt-24 grid-cols-[3px_1fr] gap-x-5 border-b border-border py-7 md:grid-cols-[3px_1fr_auto] md:gap-x-8"
    >
      <div
        className="row-span-2 w-[3px] md:row-span-1"
        style={{ backgroundColor: severityToken[sev] }}
        aria-hidden
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="label-caps">{o.kind}</span>
          <span className="label-caps">{o.format}</span>
          <span className="border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            tier {o.tier}
          </span>
          <span
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: severityToken[sev] }}
          >
            {CONFIDENCE_COPY[o.confidence] ?? o.confidence}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2.5">
          <OrgLogo organiser={o.organiser} />
          <h3 className="text-2xl font-bold leading-none md:text-3xl">{o.name}</h3>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {o.organiser} · {o.scope} · {o.career_track} career track
        </p>

        {o.notes && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{o.notes}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Stat label="prize" value={formatMoney(o.prize?.pool, o.prize?.currency)} />
          <Stat label="expected value" value={usd(expectedValueUsd(o))} />
          <Stat
            label="next date"
            value={o.next_date ?? o.dates?.["expected_window"] ?? "no window"}
          />
          {watchers.length > 0 && (
            <Stat label="watching" value={watchers.map((w) => w.watched_by).join(" + ")} />
          )}
        </div>
      </div>

      <div className="col-start-2 mt-5 flex items-center gap-6 md:col-start-3 md:mt-0 md:flex-col md:items-end md:gap-4">
        <div className="text-right">
          <div className="numeral text-5xl md:text-6xl" style={{ color: severityToken[sev] }}>
            {d === null ? "—" : d < 0 ? "past" : d}
          </div>
          <div className="label-caps mt-1">
            {d === null ? "unscheduled" : d < 0 ? "closed" : d === 1 ? "day left" : "days left"}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <WinRing value={wp} size={52} />
          <button
            aria-label={mine ? "Unwatch" : "Watch"}
            onClick={() => {
              if (!identity) {
                toast("Pick a name up top first", {
                  description: "The watchlist is shared, so it needs to know who starred it.",
                });
                return;
              }
              toggle.mutate({
                opportunityId: o.id,
                who: identity,
                watching: mine,
                name: o.name,
              });
            }}
            className={cn(
              "flex size-9 items-center justify-center border transition-colors",
              mine
                ? "border-accent text-accent"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
            )}
          >
            <Star className={cn("size-4", mine && "fill-current")} />
          </button>
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div className="mt-0.5 font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}
