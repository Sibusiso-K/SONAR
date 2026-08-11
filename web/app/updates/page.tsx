import Link from "next/link";
import updatesRaw from "@/data/updates.json";
import { getOpportunity } from "@/lib/data";

interface Update {
  at: string;
  kind: "added" | "changed" | "verified" | "missed" | "system";
  target: string | null;
  title: string;
  body: string;
  by: string;
}

const KIND_LABEL: Record<Update["kind"], string> = {
  added: "New",
  changed: "Changed",
  verified: "Verified",
  missed: "Missed",
  system: "System",
};

const KIND_TONE: Record<Update["kind"], string | undefined> = {
  added: "stable",
  changed: "warning",
  verified: "brand",
  missed: "critical",
  system: undefined,
};

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function dayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const label = d.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return isToday ? `Today · ${label}` : label;
}

export default function UpdatesPage() {
  const data = updatesRaw as { updates: Update[] };
  const updates = [...data.updates].sort((a, b) => b.at.localeCompare(a.at));

  const groups = new Map<string, Update[]>();
  for (const u of updates) {
    const k = dayKey(u.at);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(u);
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="title">Updates</h1>
          <p className="subtitle">
            Every change to the board, with who or what made it. This is the audit trail — an
            autonomous board is only trustworthy if you can see what it did.
          </p>
        </div>
      </div>

      <div className="feed">
        {[...groups.entries()].map(([day, items]) => (
          <div key={day}>
            <div className="fday">
              <span className="fd">{dayLabel(day)}</span>
              <span className="fr" />
            </div>

            {items.map((u, i) => {
              const target = u.target ? getOpportunity(u.target) : undefined;
              return (
                <div className="fitem" key={`${u.at}-${i}`} data-k={u.kind}>
                  <div className="ft">
                    {new Date(u.at).toLocaleTimeString("en-ZA", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </div>
                  <div className="fi">
                    <span />
                  </div>
                  <div className="fb">
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                        marginBottom: 3,
                      }}
                    >
                      <span className="chip" data-tone={KIND_TONE[u.kind]}>
                        {KIND_LABEL[u.kind]}
                      </span>
                      {target && (
                        <Link
                          href={`/o/${target.id}/`}
                          style={{ color: "var(--brand)", fontSize: 12.5, fontWeight: 540 }}
                        >
                          {target.name} →
                        </Link>
                      )}
                    </div>
                    <div className="fh">{u.title}</div>
                    <div className="fx">{u.body}</div>
                    <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 6 }}>
                      by <code style={{ fontFamily: "var(--mono)" }}>{u.by}</code>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 34 }}>
        <h3>What lands here once the pipeline runs</h3>
        <ul className="blist">
          <li>
            <strong>Any date change on a committed entry</strong> — the highest-value alert in the
            system, and the one nothing currently catches.
          </li>
          <li>Confidence moving up or down as sources corroborate or go stale.</li>
          <li>New opportunities found by the sweep, with the source that surfaced them.</li>
          <li>Conflicts opened and how they were adjudicated.</li>
        </ul>
      </div>
    </main>
  );
}
