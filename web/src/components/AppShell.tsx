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
  { to: "/updates", label: "Updates" },
] as const;

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
  if (!hydrated) return <div className="h-8 w-40" />;

  return (
    <div className="flex items-center border border-border">
      {CREW.map((who) => (
        <button
          key={who}
          onClick={() => setIdentity(identity === who ? null : who)}
          className={cn(
            "px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors",
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

export function AppShell({ children }: { children: ReactNode }) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-rule bg-background/85 backdrop-blur-md">
        <div className="relative mx-auto flex max-w-[88rem] items-center gap-x-4 px-5 py-3 md:px-10">
          <button
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={navOpen}
            className="flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            {navOpen ? <X className="size-3.5" /> : <Menu className="size-3.5" />}
          </button>

          <Link to="/" className="absolute left-1/2 flex -translate-x-1/2 items-baseline gap-2">
            <span className="font-display text-xl font-bold tracking-[-0.05em]">SONAR</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <IdentityPicker />
            <ThemeToggle />
            <button
              onClick={() => setAssistantOpen(true)}
              className="flex items-center gap-1.5 bg-primary px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-primary-foreground transition-opacity hover:opacity-85"
            >
              <MessageSquareText className="size-3.5" /> Ask
            </button>
          </div>
        </div>

        {/* ---- nav panel: opens/closes rather than always occupying the
            header, which is what frees the header to center the logo.
            Mounted/unmounted rather than height-animated: a real height
            (or max-height, or grid-template-rows) transition needs the
            browser to resolve an intrinsic content size mid-animation,
            which is exactly the kind of thing that silently breaks under
            odd rendering conditions. Fade + slide on mount is simpler and
            matches the animate-in idiom the shadcn primitives already use
            elsewhere in this app (dialog, popover, sheet, etc). ---- */}
        {navOpen && (
          <nav className="animate-in fade-in slide-in-from-top-2 mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-7 gap-y-3 border-t border-rule px-5 py-4 duration-200 md:px-10">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                activeProps={{ className: "text-foreground border-foreground" }}
                inactiveProps={{ className: "text-muted-foreground border-transparent" }}
                onClick={() => setNavOpen(false)}
                className="border-b-2 pb-0.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
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

      <Assistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
