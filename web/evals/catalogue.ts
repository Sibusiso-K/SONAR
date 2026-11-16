/**
 * Which free models OpenRouter lists today, and whether the ones SONAR is set
 * to use are still among them. Free catalogues change month to month; run
 * this before trusting the model order.
 *
 *   bun run eval:catalogue
 *
 * Reads the public catalogue; no key needed. Exits 1 when a configured model
 * has gone, so it can run in CI.
 */

import { DEFAULT_OPENROUTER_MODELS } from "../src/lib/assistant.providers";

type Model = {
  id: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
};

const res = await fetch("https://openrouter.ai/api/v1/models", {
  signal: AbortSignal.timeout(30_000),
});
if (!res.ok) {
  console.error(`catalogue request failed: HTTP ${res.status}`);
  process.exit(2);
}
const all = ((await res.json()) as { data: Model[] }).data;
const free = all.filter(
  (m) => m.id.endsWith(":free") || (m.pricing?.prompt === "0" && m.pricing?.completion === "0"),
);

console.log(`${free.length} free of ${all.length} models.`);
console.table(
  free.map((m) => ({
    id: m.id,
    context: m.context_length,
    tools: m.supported_parameters?.includes("tools") ? "yes" : "",
    json: m.supported_parameters?.some((p) => p === "response_format" || p === "structured_outputs")
      ? "yes"
      : "",
  })),
);

const ids = new Set(free.map((m) => m.id));
const gone = DEFAULT_OPENROUTER_MODELS.filter((m) => !ids.has(m));
if (gone.length) {
  console.error(
    `No longer free or listed: ${gone.join(", ")}. Re-run the evaluation and update the order.`,
  );
  process.exit(1);
}
console.log("Every configured model is still listed.");
