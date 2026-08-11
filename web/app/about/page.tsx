import Link from "next/link";
import {
  compactUsd,
  liveOpportunities,
  past,
  sources,
  totalTrackedUsd,
} from "@/lib/data";

export const metadata = {
  title: "SONAR — what it is",
  description:
    "A deadline nobody was watching is money nobody won. SONAR finds, verifies and schedules every opportunity worth entering — and never lets a model invent a date.",
};

export default function AboutPage() {
  const live = liveOpportunities();
  const dated = live.filter((o) => o.days_remaining !== null && o.days_remaining >= 0);
  const next = dated[0];
  const missed = past().find((p) => p.missed);
  const verified = live.filter((o) => o.confidence === "confirmed").length;
  const srcCount = sources().length;

  return (
    <>
      <section className="lp">
        <div className="lp-hero">
          <div className="lp-eyebrow">Opportunity intelligence · South Africa</div>
          <h1 className="lp-h1">
            A deadline nobody was watching is money <em>nobody won.</em>
          </h1>
          <p className="lp-sub">
            SONAR tracks every hackathon, competition, graduate programme and recruiting event
            worth a weekend — verifies the dates against their sources, schedules the prep
            backwards from the deadline, and tells you the moment something moves.
          </p>

          {/* The hero's real content is the live board, not a stock illustration. */}
          <div className="lp-strip">
            <div>
              <div className="k">Next deadline</div>
              <div
                className="v"
                style={{
                  color:
                    (next?.days_remaining ?? 99) <= 7
                      ? "var(--critical)"
                      : (next?.days_remaining ?? 99) <= 21
                        ? "var(--warning)"
                        : "var(--text)",
                }}
              >
                {next ? `${next.days_remaining}d` : "—"}
              </div>
              <div className="m">{next?.name ?? "nothing scheduled"}</div>
            </div>
            <div>
              <div className="k">Tracked</div>
              <div className="v">{live.length}</div>
              <div className="m">across 10 opportunity types</div>
            </div>
            <div>
              <div className="k">Prize pool</div>
              <div className="v">${compactUsd(totalTrackedUsd(live))}</div>
              <div className="m">cash, converted to USD</div>
            </div>
            <div>
              <div className="k">Source-confirmed</div>
              <div className="v">
                {verified}
                <span style={{ fontSize: 17, color: "var(--muted)" }}>/{live.length}</span>
              </div>
              <div className="m">the rest sit on Radar</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- the failure */}
      <section className="lp">
        <div className="lp-sec">
          <div className="lp-split">
            <div className="lp-label">Why it exists</div>
            <div>
              <h2 className="lp-h2">It was built the week we lost one.</h2>
              <div className="lp-body">
                <p>
                  On 10 August 2026 the board carried a note about an event nobody had dated. The
                  only trace of it was an empty Google Calendar someone had made months earlier
                  and never filled in.
                </p>
                {missed && (
                  <blockquote className="lp-quote">
                    {missed.name} ran three days before anyone checked.
                    <cite>
                      50 seats · R12 500 per winner · a permanent-employment route at Discovery
                    </cite>
                  </blockquote>
                )}
                <p>
                  Nothing was broken. Nobody was lazy. The board was accurate the day it was
                  written and quietly went stale after that — which is the only failure mode a
                  hand-maintained list has. <strong>SONAR is the fix for that specific
                  failure</strong>, and everything it does traces back to it: watch continuously,
                  verify against the source, and shout when a date moves.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- verification */}
      <section className="lp">
        <div className="lp-sec">
          <div className="lp-split">
            <div className="lp-label">The hard part</div>
            <div>
              <h2 className="lp-h2">A model that guesses a deadline is worse than no board.</h2>
              <div className="lp-body">
                <p>
                  A wrong date written confidently onto a calendar gets trusted. So the model is
                  never allowed to be the source of a fact — it has to <strong>quote</strong>, and
                  code checks the quote actually exists in the page that was saved.
                </p>
              </div>

              <div className="lp-demo">
                <dl style={{ margin: 0 }}>
                  <div className="lp-demo-row">
                    <dt>Field</dt>
                    <dd className="mono">/stages/0/closes</dd>
                  </div>
                  <div className="lp-demo-row">
                    <dt>Extracted</dt>
                    <dd className="mono">2026-08-24T23:45−07:00</dd>
                  </div>
                  <div className="lp-demo-row">
                    <dt>Quoted</dt>
                    <dd>
                      &ldquo;Submissions close August 24, 2026 at 11:45pm PDT&rdquo;
                    </dd>
                  </div>
                  <div className="lp-demo-row">
                    <dt>Source</dt>
                    <dd className="mono">adtc-2026.devpost.com · sha 9f2a…</dd>
                  </div>
                </dl>
                <div className="lp-verdict">
                  ✓ Quote found verbatim in the saved page — accepted
                </div>
              </div>

              <div className="lp-body" style={{ marginTop: 18 }}>
                <p>
                  If that quote isn&rsquo;t in the snapshot, the extraction is thrown away — no
                  retry, straight to a human. And the model never does the date arithmetic:
                  it returns the sentence, code parses it and converts the timezone.{" "}
                  <strong>
                    That distinction has consequences — the ADTC cutoff is 08:45 the next morning
                    in South Africa.
                  </strong>
                </p>
                <p>
                  Anything with one unverified source doesn&rsquo;t reach the board at all. It
                  waits on <Link href="/radar/" style={{ color: "var(--brand)", fontWeight: 550 }}>Radar</Link>,
                  visually separated, until an organiser page confirms it or two independent
                  sources agree.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- what it does */}
      <section className="lp">
        <div className="lp-sec">
          <div className="lp-split">
            <div className="lp-label">What it does</div>
            <div>
              <h2 className="lp-h2">Four jobs, running without being asked.</h2>
              <ul className="lp-list" style={{ marginTop: 22 }}>
                <li>
                  <span className="n">01</span>
                  <div>
                    <div className="t">Watches the organisations, not the keywords</div>
                    <div className="d">
                      {srcCount} feeds on a schedule, plus the careers and news pages of roughly
                      fifty banks, telcos, universities and consultancies. Searching finds what is
                      already popular; watching an organisation catches the announcement on day
                      one — which is the whole game when there are 50 seats.
                    </div>
                  </div>
                </li>
                <li>
                  <span className="n">02</span>
                  <div>
                    <div className="t">Re-checks harder as the deadline gets closer</div>
                    <div className="d">
                      Weekly when it&rsquo;s far off, every twelve hours inside the last week. Each
                      page is hashed, so an unchanged page costs nothing to re-check. A changed
                      date on something already committed is the loudest alert in the system.
                    </div>
                  </div>
                </li>
                <li>
                  <span className="n">03</span>
                  <div>
                    <div className="t">Predicts next year from last year</div>
                    <div className="d">
                      Two prior editions are enough to forecast a window. The event we lost has
                      run in early August three years running, so the watch for the next one opens
                      in June — months before anyone would think to look.
                    </div>
                  </div>
                </li>
                <li>
                  <span className="n">04</span>
                  <div>
                    <div className="t">Writes the prep, not just the deadline</div>
                    <div className="d">
                      Work blocks generated backwards from the cutoff, sized to what two people
                      can actually do, with a buffer the planner refuses to fill. If a date moves,
                      the whole ladder moves with it.
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- close */}
      <section className="lp">
        <div className="lp-cta">
          <Link href="/" className="lp-btn">
            Open the board →
          </Link>
          <Link href="/radar/" className="lp-btn ghost">
            See what&rsquo;s unverified
          </Link>
          <span style={{ fontSize: 13.5, color: "var(--muted)", marginLeft: 4 }}>
            Built by Sibusiso&nbsp;K and Lethabo · every date traces to a source
          </span>
        </div>
      </section>
    </>
  );
}
