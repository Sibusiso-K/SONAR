/**
 * Small pure helpers for the assistant panel: what to suggest, and how to say
 * where an answer came from. Kept out of the component so they can be tested.
 */

import { daysUntil } from "@/lib/analytics";
import { shortModel, type Provider } from "@/lib/assistant.providers";
import type { Opportunity } from "@/lib/sonar-types";

export type AnswerSource = { provider: Provider; model: string; skipped: string[] };

const PROVIDER_NAME: Record<Provider, string> = {
  openrouter: "OpenRouter",
  groq: "Groq",
  ollama: "local model",
  builtin: "built-in engine",
};

/**
 * One line under each answer saying what produced it. An answer from the
 * built-in engine is a lookup; an answer from a language model is a reading
 * of the same rows that can be wrong in ways a lookup cannot. The reader
 * should know which they are looking at.
 */
export function sourceLabel(source: AnswerSource): string {
  if (source.provider === "builtin") {
    const why = source.skipped.some((s) => /rate limited/.test(s))
      ? " · language models are rate limited just now"
      : source.skipped.some((s) => /timed out|unreachable|HTTP|upstream|nothing usable/.test(s))
        ? " · language models did not answer"
        : "";
    return `Built-in engine · read straight from the board${why}`;
  }
  return `${shortModel(source.model)} · ${PROVIDER_NAME[source.provider]}`;
}

const SHORT_NAME_MAX = 44;

/** A row's name, trimmed of a trailing parenthetical so it reads in a sentence. */
function shortName(o: Opportunity): string {
  const base = o.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || o.name;
  return base.length > SHORT_NAME_MAX ? `${base.slice(0, SHORT_NAME_MAX - 1).trimEnd()}…` : base;
}

/**
 * Four starter questions built from the rows on the board right now: the
 * highest-scored one for "why this score", the nearest dated one for a
 * checklist. With no rows yet (loading, or a failed read) the two that need
 * a name are left out rather than naming something that may not exist.
 */
export function assistantSuggestions(live: Opportunity[], now: Date = new Date()): string[] {
  const out = ["Which opportunity should we prioritise this week?"];

  const top = [...live].sort((a, b) => b.score - a.score)[0];
  if (top) out.push(`Why is ${shortName(top)} scored the way it is?`);

  const nearest = live
    .map((o) => ({ o, d: daysUntil(o.next_date, now) }))
    .filter((x): x is { o: Opportunity; d: number } => x.d !== null && x.d >= 0)
    .sort((a, b) => a.d - b.d)[0];
  if (nearest) out.push(`Draft a submission checklist for ${shortName(nearest.o)}.`);

  out.push("What conflicts or risks do you see in the board right now?");
  return out;
}
