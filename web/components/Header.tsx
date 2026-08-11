"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("sonar:theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.dataset.theme = stored;
    }
  }, []);

  function flip() {
    const next =
      theme === "dark"
        ? "light"
        : theme === "light"
          ? undefined
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "light"
            : "dark";
    if (next) {
      document.documentElement.dataset.theme = next;
      window.localStorage.setItem("sonar:theme", next);
      setTheme(next);
    } else {
      delete document.documentElement.dataset.theme;
      window.localStorage.removeItem("sonar:theme");
      setTheme(null);
    }
  }

  return (
    <button
      type="button"
      className="themebtn"
      onClick={flip}
      title={
        theme === "dark" ? "Switch to light" : theme === "light" ? "Match system" : "Switch to dark"
      }
      aria-label="Toggle color theme"
    >
      {theme === "dark" ? "☀" : theme === "light" ? "◐" : "☾"}
    </button>
  );
}

export function Header({
  liveCount,
  radarCount,
  next,
}: {
  liveCount: number;
  radarCount: number;
  next?: { id: string; name: string; days_remaining: number | null; tone: string };
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="hdr">
      <div className="hdr-in">
        <Link href="/" className="wordmark">
          <span className="mark" aria-hidden />
          SONAR
          <span className="sub">· board</span>
        </Link>

        <nav className="tabs" aria-label="Sections">
          <Link href="/" className="tab" data-active={isActive("/")}>
            Board <span className="cnt">{liveCount}</span>
          </Link>
          <Link href="/radar/" className="tab" data-active={isActive("/radar")}>
            Radar <span className="cnt">{radarCount}</span>
          </Link>
          <Link href="/updates/" className="tab" data-active={isActive("/updates")}>
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
                  next.tone === "critical"
                    ? "var(--critical)"
                    : next.tone === "warning"
                      ? "var(--warning)"
                      : "var(--text)",
              }}
            >
              {next.days_remaining}d
            </span>
            <span className="nm">{next.name}</span>
          </Link>
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}
