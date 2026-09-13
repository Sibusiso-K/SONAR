import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Moon, Sun, MessageSquareText, X } from "lucide-react";
import { CREW, useIdentity } from "@/lib/identity";
import { Assistant } from "@/components/Assistant";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Board" },
  { to: "/stats", label: "Stats" },
  { to: "/radar", label: "Radar" },
  { to: "/war-room", label: "War Room" },
  { to: "/updates", label: "Updates" },
] as const;

const SIDEBAR_WIDTH = "w-56";

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("sonar.theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  return (
    <button
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        window.localStorage.setItem("sonar.theme", next ? "dark" : "light");
      }}
      aria-label="Toggle dark mode"
      className="flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
    >
      {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </button>
  );
}

function IdentityPicker() {
  const { identity, setIdentity, hydrated } = useIdentity();
  if (!hydrated) return <div className="h-8 w-full" />;

  return (
    <div className="flex items-center border border-border">
      {CREW.map((who) => (
        <button
          key={who}
          onClick={() => setIdentity(identity === who ? null : who)}
          className={cn(
            "flex-1 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors",
            identity === who
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {who}
        </button>
      ))}
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.to === "/" }}
          activeProps={{ className: "text-foreground border-r-foreground bg-foreground/5" }}
          inactiveProps={{ className: "text-muted-foreground border-r-transparent" }}
          onClick={onNavigate}
          className="border-r-2 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:text-foreground"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background">
      {/* ---- sidebar: persistent on desktop, an off-canvas panel sliding
          in from the left on mobile rather than a top-dropping panel, so
          the section list always reads as a vertical column, not a row
          that wraps. ---- */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex flex-col border-l border-rule bg-background transition-transform duration-200 md:translate-x-0",
          SIDEBAR_WIDTH,
          navOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <Link to="/" onClick={() => setNavOpen(false)}>
            <span className="font-display text-xl font-bold tracking-[-0.05em]">SONAR</span>
          </Link>
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
            className="flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground md:hidden"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav onNavigate={() => setNavOpen(false)} />
        </div>

        <div className="flex flex-col gap-2.5 border-t border-rule p-4">
          <IdentityPicker />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setAssistantOpen(true)}
              className="flex flex-1 items-center justify-center gap-1.5 bg-primary px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-primary-foreground transition-opacity hover:opacity-85"
            >
              <MessageSquareText className="size-3.5" /> Ask
            </button>
          </div>
        </div>
      </aside>

      {/* backdrop, mobile only, while the drawer is open */}
      {navOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden"
        />
      )}

      <div className="md:pr-56">
        <header className="sticky top-0 z-20 flex items-center gap-x-4 border-b border-rule bg-background/85 px-5 py-3 backdrop-blur-md md:hidden">
          <span className="font-display text-xl font-bold tracking-[-0.05em]">SONAR</span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setAssistantOpen(true)}
              aria-label="Ask"
              className="flex size-8 items-center justify-center bg-primary text-primary-foreground transition-opacity hover:opacity-85"
            >
              <MessageSquareText className="size-3.5" />
            </button>
            <button
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={navOpen}
              className="flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <Menu className="size-3.5" />
            </button>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-24 border-t border-rule">
          <div className="mx-auto max-w-[88rem] px-5 py-10 md:px-10">
            <p className="max-w-xl text-sm text-muted-foreground">
              Every date on this board traces to a source. Where it doesn't, it says so. The archive
              keeps the misses in, including the ones we later found out weren't misses.
            </p>
          </div>
        </footer>
      </div>

      <Assistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
