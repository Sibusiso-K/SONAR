import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  FileText,
  Flag,
  Globe2,
  LayoutGrid,
  Menu,
  MessageSquareText,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Users,
  X,
} from "lucide-react";
import { CREW, useIdentity } from "@/lib/identity";
import { Assistant } from "@/components/Assistant";
import { DebriefPrompt } from "@/components/DebriefPrompt";
import { SonarField } from "@/components/SonarField";
import { cn } from "@/lib/utils";

/** Order matters: lib/page-transition.ts slides pages by position in this list. */
const NAV = [
  { to: "/", label: "Board", icon: LayoutGrid },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/radar", label: "Radar", icon: Globe2 },
  { to: "/war-room", label: "War Room", icon: Flag },
  { to: "/updates", label: "Updates", icon: FileText },
  { to: "/crew", label: "Crew", icon: Users },
] as const;

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="2.2" fill="currentColor" />
        <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="11" cy="11" r="10" stroke="currentColor" strokeWidth="1.6" opacity=".45" />
      </svg>
      <span className="font-display text-xl font-extrabold tracking-[-0.04em]">SONAR</span>
    </span>
  );
}

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
      className="glass-card flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-transform hover:scale-105"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

/** Who is using the board. Attribution only, never authentication. */
function IdentityPicker() {
  const { identity, setIdentity, hydrated } = useIdentity();
  if (!hydrated) return <div className="h-11 w-full" />;

  return (
    <div className="glass-card flex items-center gap-1 rounded-full p-1">
      {CREW.map((who) => (
        <button
          key={who}
          onClick={() => setIdentity(identity === who ? null : who)}
          aria-pressed={identity === who}
          className={cn(
            "min-h-9 flex-1 rounded-full px-2.5 text-xs font-semibold transition-colors",
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
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.to === "/" }}
          activeProps={{
            className: "bg-glass-strong text-foreground shadow-sm font-semibold",
            "aria-current": "page",
          }}
          inactiveProps={{ className: "text-muted-foreground hover:bg-foreground/5" }}
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm transition-colors hover:text-foreground"
        >
          <item.icon className="size-[18px]" aria-hidden="true" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

const NAV_COLLAPSED_KEY = "sonar.nav.collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  // Desktop only: the sidebar can be tucked away, and stays tucked across pages.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(NAV_COLLAPSED_KEY) === "1");
    } catch {
      // Blocked storage: the sidebar just starts open.
    }
  }, []);

  function setNavCollapsed(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // Blocked storage: the choice lasts until reload.
    }
  }

  return (
    <div className="min-h-dvh">
      <SonarField />

      {/* ---- sidebar: a floating glass column on desktop that can be
          retracted, an off-canvas drawer on phones (which also get the tab
          bar below). ---- */}
      <aside
        className={cn(
          "vt-site-nav glass fixed inset-y-4 left-4 z-40 flex w-60 flex-col gap-4 p-3.5 transition-transform duration-300",
          navOpen ? "translate-x-0" : "-translate-x-[120%]",
          collapsed ? "md:-translate-x-[120%]" : "md:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-2 pt-1">
          <Link to="/" onClick={() => setNavOpen(false)} aria-label="SONAR home">
            <Wordmark />
          </Link>
          <button
            onClick={() => setNavCollapsed(true)}
            aria-label="Hide the side panel"
            title="Hide the side panel"
            className="hidden size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground md:flex"
          >
            <PanelLeftClose className="size-4" />
          </button>
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground md:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="label-caps mb-2 px-3">Sections</p>
          <SidebarNav onNavigate={() => setNavOpen(false)} />
        </div>

        <div className="ink-panel relative overflow-hidden p-4">
          <span
            aria-hidden="true"
            className="absolute -right-14 -top-14 size-40 rounded-full border border-white/15"
          />
          <p className="label-caps relative" style={{ color: "var(--ink-panel-muted)" }}>
            Monday sweep
          </p>
          <p className="relative mt-2 font-display text-base font-bold leading-tight">
            Finds it, quotes it, never publishes it.
          </p>
          <Link
            to="/updates"
            onClick={() => setNavOpen(false)}
            className="relative mt-3 flex min-h-11 items-center justify-center rounded-full bg-ink-panel-foreground text-sm font-semibold text-ink-panel"
          >
            Review finds
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <IdentityPicker />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setAssistantOpen(true)}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <MessageSquareText className="size-4" /> Ask
            </button>
          </div>
        </div>
      </aside>

      {/* backdrop, phones only, while the drawer is open */}
      {navOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden"
        />
      )}

      {collapsed && (
        <button
          onClick={() => setNavCollapsed(false)}
          aria-label="Show the side panel"
          title="Show the side panel"
          className="glass fixed left-4 top-4 z-40 hidden size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground md:flex"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      <div
        className={cn(
          "transition-[padding] duration-300",
          collapsed ? "md:pl-16" : "md:pl-[17rem]",
        )}
      >
        <header className="vt-site-header sticky top-0 z-20 flex items-center gap-2 px-4 py-3 md:hidden">
          <Link to="/" aria-label="SONAR home" className="glass-card rounded-full px-4 py-2.5">
            <Wordmark />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setAssistantOpen(true)}
              aria-label="Ask"
              className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <MessageSquareText className="size-4" />
            </button>
            <button
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={navOpen}
              className="glass-card flex size-11 items-center justify-center rounded-full"
            >
              <Menu className="size-4" />
            </button>
          </div>
        </header>

        <main className="page-enter">{children}</main>

        <footer className="mt-20 pb-10">
          <div className="mx-auto max-w-[88rem] px-5 md:px-8">
            <p className="max-w-xl text-sm text-muted-foreground">
              Every date on this board traces to a source. Where it doesn't, it says so. The archive
              keeps the misses in, including the ones we later found out weren't misses.
            </p>
          </div>
        </footer>
      </div>

      <Assistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <DebriefPrompt />
    </div>
  );
}
