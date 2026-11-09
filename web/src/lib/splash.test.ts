import { describe, expect, it } from "vitest";
import {
  SPLASH_BOOT_SCRIPT,
  SPLASH_EXIT_MS,
  SPLASH_LIFT_MS,
  SPLASH_SKIP_EXIT_MS,
  SPLASH_STORAGE_KEY,
  SPLASH_TOTAL_MS,
  hasSeenSplash,
  markSplashSeen,
} from "./splash";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const throwingStorage = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
};

describe("session flag", () => {
  it("is unseen until marked, then seen", () => {
    const s = memoryStorage();
    expect(hasSeenSplash(s)).toBe(false);
    markSplashSeen(s);
    expect(hasSeenSplash(s)).toBe(true);
  });

  it("survives blocked storage without throwing", () => {
    expect(hasSeenSplash(throwingStorage)).toBe(false);
    expect(() => markSplashSeen(throwingStorage)).not.toThrow();
    expect(hasSeenSplash(undefined)).toBe(false);
    expect(() => markSplashSeen(undefined)).not.toThrow();
  });
});

describe("timings", () => {
  it("removes the overlay a fixed time after the lift starts", () => {
    expect(SPLASH_TOTAL_MS).toBe(SPLASH_LIFT_MS + SPLASH_EXIT_MS);
  });

  it("keeps the whole opening under three seconds", () => {
    expect(SPLASH_TOTAL_MS).toBeLessThan(3000);
    expect(SPLASH_SKIP_EXIT_MS).toBeLessThan(SPLASH_EXIT_MS);
  });
});

/** Run the inline <head> script against fake browser globals. */
function runBoot(opts: {
  theme?: string;
  seen?: boolean;
  reducedMotion?: boolean;
  breakLocal?: boolean;
  breakSession?: boolean;
}) {
  const classes = new Set<string>();
  const attrs = new Map<string, string>();
  const documentStub = {
    documentElement: {
      classList: { add: (c: string) => void classes.add(c) },
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
    },
  };
  const local = opts.breakLocal
    ? throwingStorage
    : memoryStorage(opts.theme ? { "sonar.theme": opts.theme } : {});
  const session = opts.breakSession
    ? throwingStorage
    : memoryStorage(opts.seen ? { [SPLASH_STORAGE_KEY]: "1" } : {});
  const windowStub = {
    matchMedia: (q: string) => ({ matches: q.includes("reduce") && Boolean(opts.reducedMotion) }),
  };
  new Function("window", "document", "localStorage", "sessionStorage", SPLASH_BOOT_SCRIPT)(
    windowStub,
    documentStub,
    local,
    session,
  );
  return { dark: classes.has("dark"), splash: attrs.get("data-splash") };
}

describe("boot script (runs before first paint)", () => {
  it("plays the splash on a first visit", () => {
    expect(runBoot({})).toEqual({ dark: false, splash: undefined });
  });

  it("applies the saved dark theme before paint", () => {
    expect(runBoot({ theme: "dark" }).dark).toBe(true);
    expect(runBoot({ theme: "light" }).dark).toBe(false);
  });

  it("skips the splash once seen this session", () => {
    expect(runBoot({ seen: true }).splash).toBe("off");
  });

  it("skips the splash for visitors who prefer reduced motion", () => {
    expect(runBoot({ reducedMotion: true }).splash).toBe("off");
  });

  it("still applies the theme when session storage is blocked, and does not throw", () => {
    const r = runBoot({ theme: "dark", breakSession: true });
    expect(r.dark).toBe(true);
    expect(r.splash).toBeUndefined();
  });

  it("does not throw when local storage is blocked", () => {
    expect(() => runBoot({ breakLocal: true })).not.toThrow();
  });
});
