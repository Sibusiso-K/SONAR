import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CountdownClock } from "@/components/CountdownClock";
import { OrgLogo } from "@/components/OrgLogo";
import { participationBadge } from "@/lib/participation";
import { useOpportunities, usePastOpportunities } from "@/lib/sonar-data";
import {
  daysUntil,
  expectedValueUsd,
  formatMoney,
  severityOf,
  severityToken,
  usd,
  winProbability,
} from "@/lib/analytics";

export const Route = createFileRoute("/o/$id")({
  component: OpportunityDetail,
});

const SCORE_LABELS: Record<string, string> = {
  career_leverage: "career leverage",
  winnability: "winnability",
  prize: "prize",
  urgency: "urgency",
};

function OpportunityDetail() {
  const { id } = Route.useParams();
  const { data: all = [], isLoading } = useOpportunities();
  const { data: past = [] } = usePastOpportunities();
  const o = all.find((x) => x.id === id);
  const p = !o ? past.find((x) => x.id === id) : undefined;

  if (isLoading) {
    return (
      <AppShell>
        <p className="mx-auto max-w-[60rem] px-5 py-24 text-sm text-muted-foreground md:px-10">
          Loading…
        </p>
      </AppShell>
    );
  }

  if (!o) {
    return (
      <AppShell>
        <section className="mx-auto max-w-[60rem] px-5 py-24 md:px-10">
          <p className="label-caps">{p ? "Past entry" : "Not found"}</p>
          <h1 className="display-lg mt-4 max-w-[18ch]">{p?.name ?? "No entry with that id."}</h1>
          {p && (
            <>
              <p className="mt-4 text-muted-foreground">
                {p.organiser} · {p.outcome}
                {p.placement ? ` · ${p.placement}` : ""}
              </p>
              {p.note && <p className="mt-4 max-w-2xl text-sm leading-relaxed">{p.note}</p>}
            </>
          )}
          <Link to="/" className="label-caps mt-8 inline-block underline underline-offset-4">
            ← Back to the board
          </Link>
        </section>
      </AppShell>
    );
  }

  const sev = severityOf(o);
  const d = daysUntil(o.next_date);
  const wp = winProbability(o);
  const participation = participationBadge(o.status);
  const scoreEntries = Object.entries(o.scores ?? {}).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number",
  );
  const linkEntries = Object.entries(o.links ?? {});

  return (
    <AppShell>
      <section className="mx-auto max-w-[60rem] px-5 pb-24 pt-16 md:px-10 md:pt-24">
        <Link to="/" className="label-caps underline underline-offset-4">
          ← Back to the board
        </Link>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <OrgLogo organiser={o.organiser} size={32} />
          <p className="label-caps" style={{ color: severityToken[sev] }}>
            {o.kind} · {o.format} · tier {o.tier}
          </p>
          <span
            className="border px-1.5 py-px font-mono text-[10px] uppercase tracking-widest"
            style={{ borderColor: participation.color, color: participation.color }}
          >
            {participation.label}
          </span>
        </div>
        <h1 className="display-lg mt-3 max-w-[20ch]">{o.name}</h1>
        <p className="mt-3 text-base text-muted-foreground">
          {o.organiser} · {o.scope} · {o.career_track} career track
        </p>

        <div className="mt-10 grid grid-cols-2 gap-px bg-rule sm:grid-cols-3">
          <Stat
            label="days left"
            value={d === null ? "—" : d < 0 ? "closed" : String(d)}
            color={severityToken[sev]}
            extra={
              d !== null &&
              d >= 0 && <CountdownClock date={o.next_date} color={severityToken[sev]} />
            }
          />
          <Stat
            label="next date"
            value={o.next_date ?? o.dates?.["expected_window"] ?? "no window"}
          />
          <Stat label="confidence" value={o.confidence} />
          <Stat label="prize" value={formatMoney(o.prize?.pool, o.prize?.currency)} />
          <Stat label="expected value" value={usd(expectedValueUsd(o))} />
          <Stat label="win probability" value={`${wp}%`} />
        </div>

        {scoreEntries.length > 0 && (
          <div className="mt-10">
            <p className="label-caps">Score breakdown</p>
            <div className="mt-3 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {scoreEntries.map(([k, v]) => (
                <div key={k}>
                  <div className="numeral text-2xl">{v}</div>
                  <div className="label-caps mt-1">{SCORE_LABELS[k] ?? k}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {o.what_to_build && <TextBlock label="What to build" text={o.what_to_build} />}
        {o.deliverables && <TextBlock label="Deliverables" text={o.deliverables} />}
        {o.eligibility && <TextBlock label="Eligibility" text={o.eligibility} />}
        {o.notes && <TextBlock label="Notes" text={o.notes} />}

        {linkEntries.length > 0 && (
          <div className="mt-10">
            <p className="label-caps">Links</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {linkEntries.map(([k, v]) => (
                <a
                  key={k}
                  href={v}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm underline underline-offset-4"
                >
                  {k}
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="mt-12 font-mono text-xs text-muted-foreground">
          Source: {o.source ?? "unknown"} · went live {o.went_live_on ?? "unknown"} · noticed{" "}
          {o.noticed_on ?? "unknown"}
        </p>
      </section>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  color,
  extra,
}: {
  label: string;
  value: string;
  color?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="bg-paper p-5">
      <div className="label-caps">{label}</div>
      <div className="numeral mt-1 text-xl" style={color ? { color } : undefined}>
        {value}
      </div>
      {extra}
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-8 max-w-2xl">
      <p className="label-caps">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
