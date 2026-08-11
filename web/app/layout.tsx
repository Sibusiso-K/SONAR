import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { liveOpportunities, meta, radarOpportunities, toneFor } from "@/lib/data";
import { Header } from "@/components/Header";

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
        <Header
          liveCount={live.length}
          radarCount={radar.length}
          next={
            next
              ? {
                  id: next.id,
                  name: next.name,
                  days_remaining: next.days_remaining,
                  tone: toneFor(next.days_remaining),
                }
              : undefined
          }
        />

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
