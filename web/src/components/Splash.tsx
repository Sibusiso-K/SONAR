import { useCallback, useEffect, useState } from "react";
import { SPLASH_LIFT_MS, SPLASH_SKIP_EXIT_MS, SPLASH_EXIT_MS, markSplashSeen } from "@/lib/splash";

type Phase = "show" | "leaving" | "gone";

const WORD = "SONAR".split("");

/**
 * Opening animation: the wordmark rises out of a mask while sonar pings
 * radiate from behind it, a hairline fills, then the whole panel lifts away
 * like a curtain.
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
      <div className="splash-rings" aria-hidden="true">
        <span />
        <span />
        <span />
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
