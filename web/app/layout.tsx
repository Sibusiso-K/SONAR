import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { liveOpportunities, meta, radarOpportunities, toneFor } from "@/lib/data";

export const metadata: Metadata = {
  title: "SONAR — opportunity board",
  description:
    "Hackathons, competitions, graduate programmes and recruiting events — found, verified and scheduled automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const live = liveOpportunities();
  const radar = radarOpportunities();
  const next = live.find((o) => o.days_remaining !== null && o.days_remaining >= 0);
  const m = meta();

  return (
    <html lang="en-ZA" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <header className="hdr">
          <div className="hdr-in">
            <Link href="/" className="wordmark">
              <span className="mark" aria-hidden />
              SONAR
              <span className="sub">· board</span>
            </Link>

            <nav className="tabs" aria-label="Sections">
              <Link href="/" className="tab">
                Board <span className="cnt">{live.length}</span>
              </Link>
              <Link href="/radar/" className="tab">
                Radar <span className="cnt">{radar.length}</span>
              </Link>
              <Link href="/updates/" className="tab">
                Updates
              </Link>
            </nav>

            {next && (
              <Link href={`/o/${next.id}/`} className="hdr-next" title={next.name}>
                <span className="lbl">Next</span>
                <span
                  className="val"
                  style={{
                    color:
                      toneFor(next.days_remaining) === "critical"
                        ? "var(--critical)"
                        : toneFor(next.days_remaining) === "warning"
                          ? "var(--warning)"
                          : "var(--text)",
                  }}
                >
                  {next.days_remaining}d
                </span>
                <span className="nm">{next.name}</span>
              </Link>
            )}
          </div>
        </header>

        {children}

        <footer className="ft">
          <div>
            Board generated {m.generated?.slice(0, 10)} · {m.base_timezone} · every date traces to a
            source
          </div>
          <div>
            <a href="https://github.com/Sibusiso-K/SONAR">github.com/Sibusiso-K/SONAR</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
