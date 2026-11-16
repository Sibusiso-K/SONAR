/**
 * Runs the assistant evaluation: every case in cases.ts, against the built-in
 * engine and against each OpenRouter model named, on the frozen board.
 *
 *   bun evals/run.ts                          built-in engine only (no key, no network)
 *   bun evals/run.ts --models a:free,b:free   also these OpenRouter models
 *   bun evals/run.ts --out evals/results/2026-11-16.json
 *   bun evals/run.ts --cases soonest,score     only these cases
 *   bun evals/run.ts --regrade evals/results/x.json   re-apply the grader to stored replies
 *
 * Needs OPENROUTER_API_KEY for the model runs. Each model run costs one
 * request per case against the free tier's daily allowance (50 a day on an
 * unfunded account), so the runner prints the budget before it starts and
 * stops a model early if its first two requests are both refused.
 */

import fs from "node:fs";
import path from "node:path";
import { answerBuiltin, BUILTIN_MODEL } from "../src/lib/assistant.builtin";
import { buildSystemPrompt, type BoardSnapshot } from "../src/lib/assistant.context";
import { CASES, FROZEN_NOW } from "./cases";
import { grade, type Grade } from "./grade";

type Row = {
  engine: string;
  case: string;
  skill: string;
  ok: boolean;
  /** Set when the request itself failed (rate limit, timeout). Not a wrong answer. */
  transportError?: string;
  /** Request sent to the whole answer received. */
  latencyMs: number;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  reply: string;
  grade?: Grade;
};

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const here = import.meta.dirname;
const raw = JSON.parse(fs.readFileSync(path.join(here, "board.snapshot.json"), "utf-8"));
const snapshot: BoardSnapshot = {
  live: raw.live,
  past: raw.past,
  updates: raw.updates,
  now: FROZEN_NOW,
};
// What an answer is allowed to quote a date from: every row, not just the
// parts that fit in the prompt.
const groundTruth = JSON.stringify(raw);
const system = buildSystemPrompt(snapshot);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Same request settings as production (assistant.providers.ts) unless overridden. */
const MAX_TOKENS = Number(flag("--max-tokens") ?? 3000);
const REASONING = flag("--reasoning") ?? "low";
const only = flag("--cases")?.split(",");
const cases = only ? CASES.filter((c) => only.includes(c.id)) : CASES;

async function askOpenRouter(model: string, question: string) {
  const started = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env["OPENROUTER_API_KEY"] ?? ""}`,
      "X-Title": "SONAR evals",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0,
      ...(REASONING ? { reasoning: { effort: REASONING } } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  }).catch((e: unknown) => ({ failed: e instanceof Error ? e.name : "error" }) as const);

  if ("failed" in res) return { latencyMs: Date.now() - started, error: res.failed };
  const body = (await res.json().catch(() => null)) as {
    error?: { code?: number; message?: string };
    choices?: { finish_reason?: string; message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  } | null;
  // Timed after the body has arrived. OpenRouter sends its response headers
  // at once and holds the connection open while the model works, so timing
  // to the headers (as the first version of this runner did) measures the
  // network, not the model.
  const latencyMs = Date.now() - started;
  if (!res.ok || body?.error) {
    return { latencyMs, error: `HTTP ${body?.error?.code ?? res.status}` };
  }
  return {
    latencyMs,
    reply: (body?.choices?.[0]?.message?.content ?? "").trim(),
    finishReason: body?.choices?.[0]?.finish_reason,
    usage: body?.usage,
  };
}

const rows: Row[] = [];

const regrade = flag("--regrade");
/** The stored run being re-marked, so its own settings and notes are kept. */
let regradedFrom: Record<string, unknown> | null = null;
if (regrade) {
  // Apply the current grader to answers already collected. Used when a
  // pattern turns out to be too narrow: the answers do not change, only the
  // marking, and the file records that it was re-marked.
  const stored = JSON.parse(fs.readFileSync(regrade, "utf-8")) as {
    rows: Row[];
    regradedOn?: string;
  };
  for (const r of stored.rows) {
    const c = CASES.find((x) => x.id === r.case);
    if (!c || r.transportError) continue;
    r.grade = grade(r.reply, c, groundTruth);
    r.ok = r.grade.pass;
  }
  stored.regradedOn = new Date().toISOString();
  rows.push(...stored.rows);
  regradedFrom = stored as unknown as Record<string, unknown>;
}

// Built-in engine: free, instant, deterministic.
for (const c of regrade ? [] : cases) {
  const started = performance.now();
  const reply = answerBuiltin([{ role: "user", content: c.question }], snapshot).reply;
  const g = grade(reply, c, groundTruth);
  rows.push({
    engine: BUILTIN_MODEL,
    case: c.id,
    skill: c.skill,
    ok: g.pass,
    latencyMs: Math.round(performance.now() - started),
    reply,
    grade: g,
  });
}

const models = (flag("--models") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (models.length > 0) {
  console.error(
    `Model runs: ${models.length} models x ${cases.length} cases = ${models.length * cases.length} requests.`,
  );
}

for (const model of regrade ? [] : models) {
  let refusedInARow = 0;
  for (const c of cases) {
    if (refusedInARow >= 2) {
      rows.push({
        engine: model,
        case: c.id,
        skill: c.skill,
        ok: false,
        transportError: "skipped: model unavailable",
        latencyMs: 0,
        reply: "",
      });
      continue;
    }
    let r = await askOpenRouter(model, c.question);
    if (r.error === "HTTP 429") {
      // One patient retry: free pools refill within the minute.
      await sleep(25_000);
      r = await askOpenRouter(model, c.question);
    }
    if (r.error || !r.reply) {
      refusedInARow += 1;
      rows.push({
        engine: model,
        case: c.id,
        skill: c.skill,
        ok: false,
        transportError:
          r.error ??
          `empty reply (finish_reason ${("finishReason" in r && r.finishReason) || "unknown"})`,
        latencyMs: r.latencyMs,
        reply: "",
      });
      console.error(`  ${model} ${c.id}: ${r.error ?? "empty reply"}`);
    } else {
      refusedInARow = 0;
      const g = grade(r.reply, c, groundTruth);
      rows.push({
        engine: model,
        case: c.id,
        skill: c.skill,
        ok: g.pass,
        latencyMs: r.latencyMs,
        finishReason: r.finishReason,
        promptTokens: r.usage?.prompt_tokens,
        completionTokens: r.usage?.completion_tokens,
        reasoningTokens: r.usage?.completion_tokens_details?.reasoning_tokens,
        reply: r.reply,
        grade: g,
      } as Row);
      console.error(`  ${model} ${c.id}: ${g.pass ? "pass" : "FAIL"} (${r.latencyMs}ms)`);
    }
    // Stay well under the free tier's 20 requests a minute.
    await sleep(3_500);
  }
}

/* ---------------- summary ---------------- */

const engines = [...new Set(rows.map((r) => r.engine))];
const summary = engines.map((engine) => {
  const mine = rows.filter((r) => r.engine === engine);
  const answered = mine.filter((r) => !r.transportError);
  const lat = answered.map((r) => r.latencyMs).sort((a, b) => a - b);
  return {
    engine,
    cases: mine.length,
    answered: answered.length,
    passed: mine.filter((r) => r.ok).length,
    /** Passed out of the cases it actually answered: quality, separate from availability. */
    passRateWhenAnswered: answered.length
      ? Math.round((answered.filter((r) => r.ok).length / answered.length) * 100)
      : null,
    ungroundedDateAnswers: answered.filter((r) => (r.grade?.ungroundedDates.length ?? 0) > 0)
      .length,
    medianLatencyMs: lat.length ? lat[Math.floor(lat.length / 2)]! : null,
    maxLatencyMs: lat.length ? lat[lat.length - 1]! : null,
    failed: mine.filter((r) => !r.ok).map((r) => r.case),
  };
});

const report = {
  ranOn: new Date().toISOString(),
  frozenBoard: raw.frozen_on,
  promptChars: system.length,
  // A re-mark keeps the settings the answers were actually produced with.
  settings: regradedFrom?.["settings"] ?? {
    maxTokens: MAX_TOKENS,
    reasoningEffort: REASONING,
    temperature: 0,
  },
  ...(regradedFrom?.["note"] ? { note: regradedFrom["note"] } : {}),
  ...(regradedFrom ? { regradedOn: new Date().toISOString() } : {}),
  cases: cases.length,
  summary,
  rows,
};

const out = flag("--out");
if (out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 1) + "\n");
  console.error(`wrote ${out}`);
}

console.table(
  summary.map((s) => ({
    engine: s.engine,
    passed: `${s.passed}/${s.cases}`,
    answered: s.answered,
    "ungrounded dates": s.ungroundedDateAnswers,
    "median ms": s.medianLatencyMs,
    failed: s.failed.join(",") || "-",
  })),
);

// The built-in engine is the floor everything else is measured against, and
// it is deterministic, so a failure there is a regression, not noise.
const builtin = summary.find((s) => s.engine === BUILTIN_MODEL);
if (builtin && builtin.passed !== builtin.cases) {
  console.error(`built-in engine failed: ${builtin.failed.join(", ")}`);
  for (const r of rows.filter((x) => x.engine === BUILTIN_MODEL && !x.ok)) {
    console.error(`--- ${r.case}\n${r.reply}\n`, r.grade);
  }
  process.exit(1);
}
