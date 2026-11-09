/**
 * A small sliding-window rate limiter for public server functions.
 *
 * The assistant endpoint is unauthenticated and every call spends paid LLM
 * tokens with a ~6,000-token prompt, so without a limit anyone holding the
 * URL can run up the bill or exhaust the provider's per-minute quota for
 * everyone else.
 *
 * State lives in process memory. On serverless hosting each warm instance
 * keeps its own counters, so this is a best-effort brake that stops
 * hammering from one client, not a global guarantee. A hard guarantee needs
 * a shared store (Redis/KV) or the platform's edge rate limiting; this is
 * the part that can be tested and shipped without new infrastructure.
 */

export type RateVerdict = { ok: true } | { ok: false; retryAfterSec: number };

export type RateLimiter = {
  check(key: string, now?: number): RateVerdict;
};

export function createRateLimiter(opts: {
  /** Requests allowed per key inside the window. */
  limit: number;
  windowMs: number;
  /** Upper bound on tracked keys so a flood of distinct keys cannot grow memory without limit. */
  maxKeys?: number;
}): RateLimiter {
  const { limit, windowMs, maxKeys = 5_000 } = opts;
  const hits = new Map<string, number[]>();

  return {
    check(key, now = Date.now()) {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

      if (recent.length >= limit) {
        // The oldest hit still in the window decides when a slot frees up.
        const retryAfterMs = recent[0]! + windowMs - now;
        hits.set(key, recent);
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
      }

      recent.push(now);
      // Re-insert so Map iteration order tracks recency (oldest first).
      hits.delete(key);
      hits.set(key, recent);

      while (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest === undefined) break;
        hits.delete(oldest);
      }
      return { ok: true };
    },
  };
}
