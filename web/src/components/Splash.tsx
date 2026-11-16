import { useCallback, useEffect, useState } from "react";
import { SPLASH_LIFT_MS, SPLASH_SKIP_EXIT_MS, SPLASH_EXIT_MS, markSplashSeen } from "@/lib/splash";

type Phase = "show" | "leaving" | "gone";

const WORD = "SONAR".split("");

/** Where the four contacts sit on the scope, and when the beam (one turn in
 * 1.5 s, starting at twelve o'clock) reaches each. */
const CONTACTS = [
  { left: "67%", top: "23%", color: "oklch(0.72 0.17 30)", at: 250 },
  { left: "82%", top: "64%", color: "oklch(0.8 0.13 80)", at: 620 },
  { left: "38%", top: "82%", color: "oklch(0.8 0.13 80)", at: 980 },
  { left: "20%", top: "34%", color: "oklch(0.95 0.01 88)", at: 1330 },
];

/**
 * Opening animation: a sonar beam turns once across a dark scope and picks
 * out four contacts, the wordmark rises out of a mask, a hairline fills, then
 * the whole panel lifts away like a curtain onto the board.
 *
 * Rendered by the server and driven by CSS first, so it also disappears with
 * JavaScript off or before hydration (the exit animation has a built-in
 * delay). Once hydrated, React takes over only to remove it from the DOM,
 * to let a click or key skip it, and to remember it has played this session.
 * A <head> script marks <html data-splash="off"> to hide it instantly on
 * repeat visits and for reduced-motion users (see lib/splash.ts).
 */
export function Splash() {
  const [phase, setPhase] = useState<Phase>("show");
  // True once React has hydrated and the skip handlers are attached. Tests
  // wait on it instead of racing hydration.
  const [ready, setReady] = useState(false);

  const skip = useCallback(() => {
    setPhase((p) => (p === "show" ? "leaving" : p));
  }, []);

  // Start the lift on schedule, unless it has already been skipped.
  useEffect(() => {
    if (document.documentElement.dataset["splash"] === "off") {
      setPhase("gone");
      return;
    }
    markSplashSeen(window.sessionStorage);
    setReady(true);
    const id = window.setTimeout(
      () => setPhase((p) => (p === "show" ? "leaving" : p)),
      SPLASH_LIFT_MS,
    );
    return () => window.clearTimeout(id);
  }, []);

  // Once lifting, remove the overlay when the exit animation has finished.
  useEffect(() => {
    if (phase !== "leaving") return;
    const skipped = document.documentElement.dataset["splashSkipped"] === "1";
    const id = window.setTimeout(
      () => setPhase("gone"),
      (skipped ? SPLASH_SKIP_EXIT_MS : SPLASH_EXIT_MS) + 50,
    );
    return () => window.clearTimeout(id);
  }, [phase]);

  // Any key press skips it too.
  useEffect(() => {
    if (phase !== "show") return;
    const onKey = () => {
      document.documentElement.dataset["splashSkipped"] = "1";
      skip();
    };
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, skip]);

  if (phase === "gone") return null;

  return (
    <div
      className="splash"
      data-phase={phase}
      data-testid="splash"
      data-ready={ready ? "true" : undefined}
      role="status"
      aria-live="polite"
      aria-label="Loading SONAR"
      onClick={() => {
        document.documentElement.dataset["splashSkipped"] = "1";
        skip();
      }}
    >
      <div className="splash-scope" aria-hidden="true">
        {[0, 12.5, 25, 37.5].map((inset) => (
          <span key={inset} className="ring" style={{ inset: `${inset}%` }} />
        ))}
        <span className="beam" />
        {/* Contacts light up as the beam passes their bearing. They carry no
            labels: the splash plays before the board has loaded, and a date
            shown here would be one nobody had read from the data. */}
        {CONTACTS.map((c, i) => (
          <span
            key={i}
            className="splash-contact"
            style={{ left: c.left, top: c.top, color: c.color, animationDelay: `${c.at}ms` }}
          >
            <i />
          </span>
        ))}
      </div>

      <div className="splash-center">
        <p className="label-caps splash-caption">Opportunity board</p>
        <p className="splash-word" aria-hidden="true">
          {WORD.map((ch, i) => (
            <span key={i} className="splash-mask">
              <span className="splash-letter" style={{ animationDelay: `${120 + i * 75}ms` }}>
                {ch}
              </span>
            </span>
          ))}
        </p>
        <div className="splash-bar" aria-hidden="true">
          <span />
        </div>
        <p className="label-caps splash-status">Scanning the board</p>
      </div>

      <p className="label-caps splash-skip">Click to skip</p>
    </div>
  );
}
