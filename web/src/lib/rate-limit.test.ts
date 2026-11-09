import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit, then blocks", () => {
    const rl = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(rl.check("a", 0).ok).toBe(true);
    expect(rl.check("a", 1).ok).toBe(true);
    expect(rl.check("a", 2).ok).toBe(true);
    expect(rl.check("a", 3).ok).toBe(false);
  });

  it("reports when the oldest hit leaves the window", () => {
    const rl = createRateLimiter({ limit: 2, windowMs: 60_000 });
    rl.check("a", 10_000);
    rl.check("a", 20_000);
    const v = rl.check("a", 30_000);
    expect(v).toEqual({ ok: false, retryAfterSec: 40 }); // 10_000 + 60_000 - 30_000 = 40s
  });

  it("frees a slot as the window slides", () => {
    const rl = createRateLimiter({ limit: 2, windowMs: 60_000 });
    rl.check("a", 0);
    rl.check("a", 1_000);
    expect(rl.check("a", 59_000).ok).toBe(false);
    expect(rl.check("a", 60_001).ok).toBe(true); // first hit has aged out
  });

  it("does not count blocked attempts against the caller", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1_000 });
    rl.check("a", 0);
    for (let t = 1; t < 900; t += 100) rl.check("a", t);
    expect(rl.check("a", 1_001).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(rl.check("a", 0).ok).toBe(true);
    expect(rl.check("b", 0).ok).toBe(true);
    expect(rl.check("a", 1).ok).toBe(false);
  });

  it("never reports a retry shorter than one second", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1_000 });
    rl.check("a", 0);
    const v = rl.check("a", 999);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it("bounds memory by evicting the least recently seen keys", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 3 });
    for (const k of ["a", "b", "c", "d"]) rl.check(k, 0);
    // "a" was evicted to make room, so it starts fresh instead of staying blocked.
    expect(rl.check("a", 1).ok).toBe(true);
    // "d" is still tracked and still blocked.
    expect(rl.check("d", 1).ok).toBe(false);
  });
});
