/**
 * The moving parts of the background field (components/SonarField.tsx) that
 * can be reasoned about without a canvas.
 */

export type Ripple = {
  x: number;
  y: number;
  /** performance.now() when it started. */
  born: number;
  /** Pixels per millisecond the ring's edge travels. */
  speed: number;
  /** Milliseconds until it has faded out completely. */
  life: number;
  /** Peak effect on a dot, 0..1. */
  strength: number;
};

/** Never more than this many rings at once: a fast pointer must not turn a
 * decoration into a per-frame cost that grows without limit. */
export const MAX_RIPPLES = 14;

/** Drop rings that have faded; keep only the newest few of the rest. */
export function fieldStep(ripples: Ripple[], now: number): Ripple[] {
  const live = ripples.filter((r) => now - r.born < r.life);
  return live.length > MAX_RIPPLES ? live.slice(live.length - MAX_RIPPLES) : live;
}
