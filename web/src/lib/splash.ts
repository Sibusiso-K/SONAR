/**
 * Opening-animation logic, kept free of React and the DOM so it can be tested.
 *
 * The splash plays once per browser session: it is an opening, not a toll
 * booth, so it must not replay on every reload. It is skipped for visitors who
 * ask their OS for reduced motion.
 */

export const SPLASH_STORAGE_KEY = "sonar.splash.seen";

/** When the curtain starts to lift, measured from first paint. */
export const SPLASH_LIFT_MS = 1700;
/** How long the lift itself takes (must match `splash-exit` in styles.css). */
export const SPLASH_EXIT_MS = 650;
/** Hard upper bound: the overlay is removed no later than this. */
export const SPLASH_TOTAL_MS = SPLASH_LIFT_MS + SPLASH_EXIT_MS;
/** How long a click- or key-triggered skip takes to lift. */
export const SPLASH_SKIP_EXIT_MS = 450;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Whether the splash has already played in this session. Never throws:
 * storage can be blocked (private mode, embedded frames, disabled cookies). */
export function hasSeenSplash(storage: StorageLike | undefined): boolean {
  try {
    return storage?.getItem(SPLASH_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSplashSeen(storage: StorageLike | undefined): void {
  try {
    storage?.setItem(SPLASH_STORAGE_KEY, "1");
  } catch {
    // Blocked storage only means the splash may play again next load.
  }
}

/**
 * Runs in <head>, before first paint, as an inline script. It does two jobs
 * that cannot wait for React to hydrate:
 *   1. Applies the saved dark theme, so a dark-mode visitor does not see a
 *      cream flash (the splash would otherwise open on the wrong theme).
 *   2. Marks <html data-splash="off"> when the splash should not play (already
 *      seen this session, or reduced motion), so CSS hides the server-rendered
 *      overlay immediately instead of after hydration.
 *
 * Written as a string because it must run before the bundle loads. The
 * storage keys are duplicated here on purpose; splash.test.ts executes this
 * exact string to keep them in step with the constants above.
 */
export const SPLASH_BOOT_SCRIPT = `(function(){var d=document.documentElement;try{if(localStorage.getItem("sonar.theme")==="dark")d.classList.add("dark")}catch(e){}try{if(sessionStorage.getItem("${SPLASH_STORAGE_KEY}")==="1"||window.matchMedia("(prefers-reduced-motion: reduce)").matches)d.setAttribute("data-splash","off")}catch(e){}})();`;
