/**
 * Where the assistant's answers come from.
 *
 * Four backends, tried in order until one answers:
 *
 *   1. OpenRouter — free, open-weight models. Tried one model at a time down
 *      a short list, because free endpoints share an upstream pool and any
 *      one of them is rate limited (HTTP 429) several times a day.
 *   2. Groq — only if GROQ_API_KEY is set. The original backend, kept as a
 *      second vendor so one company's outage is not the assistant's.
 *   3. Ollama — a model on the same machine. Development only: a serverless
 *      host has nothing listening on localhost.
 *   4. The built-in engine (assistant.builtin.ts) — not a language model,
 *      reads the rows directly, needs nothing, always answers.
 *
 * All three network backends speak the OpenAI chat-completions shape, so the
 * difference between them is a URL, a model name and a header.
 *
 * Every reply carries the provider that produced it and why the ones before
 * it did not, so the interface can say which. "The built-in engine says the
 * deadline is the 22nd" and "a 1.7B model says the deadline is the 22nd" are
 * not the same claim, and the reader should not have to guess which it is.
 *
 * The model order below is a measured ranking, not a preference: see
 * docs/MODELS.md and web/evals/results for the runs behind it.
 */

export type Provider = "openrouter" | "groq" | "ollama" | "builtin";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOk = {
  reply: string;
  provider: Provider;
  model: string;
  /** Why each backend tried before this one did not answer. Empty when the
   * first choice answered. Server-side detail is already stripped. */
  skipped: string[];
};
export type ChatErr = { error: string };

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Free models on OpenRouter, in the order measured on 16 Nov 2026 against the
 * frozen board in web/evals (docs/MODELS.md has the tables):
 *
 *   nemotron-3-ultra       8 of 8 graded answers right, about 16 s each.
 *   nemotron-3.5-lightning 7 of 8, about 9 s, but it twice spent its whole
 *                          token budget reasoning about an open "what closes
 *                          soonest" question and returned nothing.
 *   gemma-4-31b            right when it answered; its shared upstream pool
 *                          refused 2 of 3 requests. A refusal costs half a
 *                          second, so it is a cheap last try.
 *
 * Correct-but-slower leads: a wrong deadline costs more than eight seconds.
 * Free catalogues change month to month. OPENROUTER_MODELS (comma-separated)
 * replaces this list without a code change, and `bun run eval:catalogue`
 * reports which of these still exist.
 */
export const DEFAULT_OPENROUTER_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "google/gemma-4-31b-it:free",
] as const;

/** How many models down the list one question may try. */
const MAX_OPENROUTER_ATTEMPTS = 3;
/** One attempt may take this long: the slowest good answer measured was 17 s. */
const OPENROUTER_ATTEMPT_MS = 28_000;
/** All attempts together. Past this a person has stopped waiting, and the
 * built-in engine answers instead. */
const OPENROUTER_TOTAL_MS = 45_000;

type Env = Record<string, string | undefined>;

export type ChatDeps = {
  env?: Env;
  fetch?: typeof fetch;
  /** Clock, in milliseconds. Injected by tests. */
  now?: () => number;
};

export function openRouterModels(env: Env): string[] {
  const raw = env["OPENROUTER_MODELS"];
  const listed = raw
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return listed && listed.length > 0 ? listed : [...DEFAULT_OPENROUTER_MODELS];
}

/** Ollama's default port. Overridable for a box that runs it elsewhere. */
function ollamaBase(env: Env) {
  return (env["OLLAMA_BASE_URL"] || "http://localhost:11434").replace(/\/+$/, "");
}

/**
 * qwen2.5-coder:3b, not the strongest model installed. phi4 (14.7B) and the
 * 7.6B qwen build were timed against the real board prompt on a CPU-only box
 * on 25 Aug 2026 and neither finished in 200 seconds; the 3B model answered
 * in 8. Without a GPU, model size is the dominant cost. On better hardware,
 * change OLLAMA_MODEL rather than this default.
 */
function ollamaModel(env: Env) {
  return env["OLLAMA_MODEL"] || "qwen2.5-coder:3b";
}

/**
 * Some reasoning models emit their scratchpad inline in <think> blocks. That
 * is not an answer and must never reach the reader. (OpenRouter returns
 * reasoning in a separate field, which is simply not read.)
 */
export function stripThinking(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .trim();
}

type RawChoice = { choices?: { message?: { content?: unknown } }[] };

type CallResult = { ok: true; reply: string } | { ok: false; error: string };

async function callOpenAIShape(
  doFetch: typeof fetch,
  url: string,
  model: string,
  messages: ChatMessage[],
  opts: {
    apiKey?: string;
    timeoutMs: number;
    maxTokens: number;
    headers?: Record<string, string>;
    /** Extra request-body fields a provider understands (e.g. OpenRouter's `reasoning`). */
    extra?: Record<string, unknown>;
  },
): Promise<CallResult> {
  let res: Response;
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
        ...opts.headers,
      },
      // max_tokens is required, not a nicety. Uncapped, Groq reserved a
      // speculative completion budget against the per-minute token limit and
      // rejected every request with a 413. On a local model it bounds CPU
      // decode time. Temperature 0: these are lookups, not brainstorming.
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens,
        temperature: 0,
        ...opts.extra,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (e) {
    // "Not running" is the normal case for Ollama in production and should
    // read as that, not as a crash.
    const why = e instanceof Error && e.name === "TimeoutError" ? "timed out" : "unreachable";
    return { ok: false, error: why };
  }

  if (res.status === 429) return { ok: false, error: "rate limited" };
  if (!res.ok) {
    // The upstream body can carry account details (organisation IDs, quota
    // figures). It goes to the server log; the visitor gets the status.
    const detail = await res.text().catch(() => "");
    console.error(`[assistant] upstream HTTP ${res.status} (${model}):`, detail.slice(0, 500));
    return { ok: false, error: `HTTP ${res.status}` };
  }

  const json = (await res.json().catch(() => null)) as
    (RawChoice & { error?: { code?: number } }) | null;
  // OpenRouter can answer 200 with an error object when the upstream
  // provider failed after the response had started.
  if (json?.error) {
    return { ok: false, error: json.error.code === 429 ? "rate limited" : "upstream error" };
  }
  const content = json?.choices?.[0]?.message?.content;
  const reply = stripThinking(typeof content === "string" ? content : "");
  // A reasoning model that spends its whole budget thinking returns an empty
  // string with finish_reason "length": a silent non-answer.
  if (!reply) return { ok: false, error: "returned nothing usable" };
  return { ok: true, reply };
}

/**
 * Ask the backends in order. `builtin` is the last resort and is supplied by
 * the caller because it needs the board rows, not a prompt; when it is given
 * this function cannot fail.
 *
 * `compactMessages` replaces `messages` for Ollama only: a small local model
 * silently truncates the full prompt (see assistant.context.ts).
 */
export async function chat(
  messages: ChatMessage[],
  opts: {
    compactMessages?: ChatMessage[];
    builtin?: () => { reply: string; model: string };
  } = {},
  deps: ChatDeps = {},
): Promise<ChatOk | ChatErr> {
  const env = deps.env ?? process.env;
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const pinned = env["ASSISTANT_PROVIDER"] as Provider | "auto" | undefined;
  const only = pinned && pinned !== "auto" ? pinned : null;
  const wants = (p: Provider) => only === null || only === p;

  const skipped: string[] = [];

  /* ---- 1. OpenRouter ---- */
  const openRouterKey = env["OPENROUTER_API_KEY"];
  if (wants("openrouter")) {
    if (!openRouterKey) {
      skipped.push("OpenRouter: no key configured");
    } else {
      const models = openRouterModels(env).slice(0, MAX_OPENROUTER_ATTEMPTS);
      const startedAt = now();
      for (const model of models) {
        const left = OPENROUTER_TOTAL_MS - (now() - startedAt);
        if (left < 3_000) {
          skipped.push(`${shortModel(model)}: not tried, out of time`);
          continue;
        }
        const r = await callOpenAIShape(doFetch, OPENROUTER_URL, model, messages, {
          apiKey: openRouterKey,
          timeoutMs: Math.min(OPENROUTER_ATTEMPT_MS, left),
          // Every free model here reasons before it answers, and reasoning
          // is counted against this cap. At 1,500 two of four models
          // returned an empty string on a list question; 3,000 with low
          // reasoning effort is the setting the evaluation was run at.
          maxTokens: 3_000,
          extra: { reasoning: { effort: "low" } },
          // Optional attribution header OpenRouter documents for apps.
          headers: { "X-Title": "SONAR" },
        });
        if (r.ok) return { reply: r.reply, provider: "openrouter", model, skipped };
        skipped.push(`${shortModel(model)}: ${r.error}`);
      }
    }
  }

  /* ---- 2. Groq ---- */
  const groqKey = env["GROQ_API_KEY"];
  if (wants("groq") && groqKey) {
    // Groq's catalogue moves fast: two models hardcoded here were retired
    // inside a year. GROQ_MODEL makes the next one an env change.
    const model = env["GROQ_MODEL"] || "openai/gpt-oss-120b";
    const r = await callOpenAIShape(doFetch, GROQ_URL, model, messages, {
      apiKey: groqKey,
      timeoutMs: 30_000,
      // gpt-oss-120b reasons before answering: at 300 it spent 298 tokens
      // thinking and returned nothing. 900 fits scratchpad plus reply.
      maxTokens: 900,
    });
    if (r.ok) return { reply: r.reply, provider: "groq", model, skipped };
    skipped.push(`${shortModel(model)}: ${r.error}`);
  } else if (only === "groq") {
    skipped.push("Groq: no key configured");
  }

  /* ---- 3. Ollama (a machine you run, never a serverless host) ---- */
  const onServerless = Boolean(env["VERCEL"] || env["AWS_LAMBDA_FUNCTION_NAME"]);
  const ollamaConfigured = Boolean(env["OLLAMA_BASE_URL"]);
  if (wants("ollama") && (ollamaConfigured || !onServerless)) {
    const model = ollamaModel(env);
    const r = await callOpenAIShape(
      doFetch,
      `${ollamaBase(env)}/v1/chat/completions`,
      model,
      opts.compactMessages ?? messages,
      // Generous for the compact prompt on a CPU. With nothing listening the
      // connection is refused at once, so this is not a 45-second wait.
      { timeoutMs: 45_000, maxTokens: 400 },
    );
    if (r.ok) return { reply: r.reply, provider: "ollama", model, skipped };
    skipped.push(`local model: ${r.error}`);
  }

  /* ---- 4. Built-in engine ---- */
  if (wants("builtin") && opts.builtin) {
    const b = opts.builtin();
    return { reply: b.reply, provider: "builtin", model: b.model, skipped };
  }

  return { error: `The assistant could not answer. ${skipped.join(" | ")}` };
}

/** "nvidia/nemotron-3.5-lightning:free" -> "nemotron-3.5-lightning". */
export function shortModel(model: string): string {
  return model.replace(/^[^/]+\//, "").replace(/:free$/, "");
}
