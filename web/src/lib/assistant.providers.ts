/**
 * Where the assistant's answers come from.
 *
 * Two backends, both speaking the OpenAI chat-completions shape, which is
 * the only reason this is small: Ollama exposes an OpenAI-compatible
 * endpoint at /v1, so the request body is identical to Groq's and the
 * difference collapses to a base URL, a model name and an auth header.
 *
 * Order is deliberate and not a preference: Groq's model answers questions
 * about real deadlines and real prize money more reliably than anything
 * running locally on this box (see ollamaModel below for why that is a
 * measured claim, not an assumption). So Groq is primary and local is the
 * fallback, not a peer. Every reply carries the provider that produced it
 * so the UI can say which, because "the local model said your deadline is
 * the 5th" deserves to be read with more suspicion than the same sentence
 * from Groq.
 */

export type Provider = "groq" | "ollama";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOk = { reply: string; provider: Provider; model: string };
export type ChatErr = { error: string };

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Ollama's default port. Overridable for a box that runs it elsewhere. */
function ollamaBase() {
  return (process.env["OLLAMA_BASE_URL"] || "http://localhost:11434").replace(/\/+$/, "");
}

/**
 * qwen2.5-coder:3b, not the strongest model installed. This was phi4:latest
 * (14.7B) until it was actually timed against the real stuffed board prompt
 * (~2-3k tokens) on 25 Aug 2026 and never finished in 200 seconds. The 7.6B
 * qwen2.5-coder build failed the same way. Only the 3B model returned an
 * answer, in 8 seconds. On this box, without a GPU, model size is the
 * dominant cost and a correct-but-slow answer that the request times out
 * before receiving is worth exactly as much as no answer at all. If this
 * ever runs on hardware that can carry a bigger model within the timeout
 * below, change OLLAMA_MODEL rather than this default — the ranking here is
 * a hardware finding, not a statement that 3B models reason better.
 */
function ollamaModel() {
  return process.env["OLLAMA_MODEL"] || "qwen2.5-coder:3b";
}

/**
 * Reasoning models (deepseek-r1 and friends) emit their scratchpad inline
 * in <think> blocks. That is not an answer and must never reach the user,
 * so it is stripped rather than displayed. Kept here rather than in the
 * caller because it is a property of the model, not of this app.
 */
function stripThinking(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .trim();
}

type RawChoice = { choices?: { message?: { content?: string } }[] };

async function callOpenAIShape(
  url: string,
  model: string,
  messages: ChatMessage[],
  opts: { apiKey?: string; timeoutMs: number; maxTokens: number },
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
      },
      // max_tokens is not an optional nicety here: Groq's on-demand tier
      // rejected every request from this key with a 413 ("Request too
      // large... TPM: Limit 8000, Requested 11863") until this was added.
      // With no cap, Groq reserves a large speculative completion budget
      // against the per-minute token limit before generating a single
      // token, and that reservation alone blew the account's TPM ceiling —
      // measured, not assumed: the same prompt with max_tokens capped at
      // 800 used a real total of 5635 tokens and returned in 1.2 seconds.
      // Capped on the Ollama call too, for a different reason: it bounds
      // CPU decode time, which is most of the local latency budget.
      body: JSON.stringify({ model, messages, max_tokens: opts.maxTokens }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (e) {
    // Covers both a dead host and the abort. Distinguished because "not
    // running" is the normal case for Ollama in production and should read
    // as such rather than as a crash.
    const why = e instanceof Error && e.name === "TimeoutError" ? "timed out" : "unreachable";
    return { ok: false, error: `${why}` };
  }

  if (res.status === 429) return { ok: false, error: "rate limited" };
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status} ${detail.slice(0, 200)}`.trim() };
  }

  const json = (await res.json().catch(() => null)) as RawChoice | null;
  const reply = stripThinking(json?.choices?.[0]?.message?.content ?? "");
  if (!reply) return { ok: false, error: "returned nothing usable" };
  return { ok: true, reply };
}

/**
 * Try Groq, then the local box. `ASSISTANT_PROVIDER` pins one of them when
 * you want to test a specific backend instead of taking whatever answers.
 *
 * `ollamaMessages`, when given, replaces `messages` for the Ollama leg only.
 * They are not interchangeable: Groq gets the full board prompt, Ollama
 * gets a deliberately smaller one built in assistant.functions.ts, because
 * the full prompt on this box either got silently truncated by Ollama's
 * default context window (fast, but answering from a quarter of the real
 * data) or took 200+ seconds once that was fixed by widening the context.
 * A caller that only has one prompt can omit this and both legs share it.
 */
export async function chat(
  messages: ChatMessage[],
  opts?: { ollamaMessages?: ChatMessage[] },
): Promise<ChatOk | ChatErr> {
  const pinned = process.env["ASSISTANT_PROVIDER"] as Provider | "auto" | undefined;
  const apiKey = process.env["GROQ_API_KEY"];

  const wantGroq = pinned !== "ollama" && Boolean(apiKey);
  const wantOllama = pinned !== "groq";

  const failures: string[] = [];

  // `wantGroq` already implies a key, but TypeScript cannot narrow through a
  // boolean under exactOptionalPropertyTypes, so re-test it here.
  if (wantGroq && apiKey) {
    // Second model change on this line: deepseek-r1-distill-llama-70b was
    // deprecated 2 Sept 2025 and replaced with llama-3.3-70b-versatile,
    // which has since vanished from this key's /v1/models entirely — not
    // erroring, just gone from the catalog. Confirmed against the live
    // model list on 25 Aug 2026 rather than assumed: openai/gpt-oss-120b is
    // what actually answers today. Groq's catalog moves fast enough that
    // hardcoding a model here is inherently a wager; GROQ_MODEL exists so
    // the next deprecation is a one-line env change, not another PR.
    const model = process.env["GROQ_MODEL"] || "openai/gpt-oss-120b";
    const r = await callOpenAIShape(GROQ_URL, model, messages, {
      apiKey,
      timeoutMs: 30_000,
      // 900, not something smaller: gpt-oss-120b is a reasoning model and
      // spends completion tokens on an internal scratchpad before it writes
      // anything visible. Measured directly: at max_tokens 300, it spent
      // 298 of them thinking and returned content: "" with finish_reason
      // "length" — a silent non-answer, worse than an honest error, because
      // callOpenAIShape's "returned nothing usable" check catches it, but
      // only after burning the request. 900 leaves room for the scratchpad
      // and the reply (measured: 636 reasoning + a real answer, 6,731
      // total) while the trimmed prompt (see truncate() above) still fits
      // comfortably under the account's 8,000 TPM ceiling.
      maxTokens: 900,
    });
    if (r.ok) return { reply: r.reply, provider: "groq", model };
    failures.push(`Groq (${model}): ${r.error}`);
  } else if (pinned !== "ollama" && !apiKey) {
    failures.push("Groq: no GROQ_API_KEY set");
  }

  if (wantOllama) {
    const model = ollamaModel();
    // The reduced-data prompt (opts.ollamaMessages), not the full board
    // prompt: that is the actual fix for the truncation/200s problem
    // described above, not the timeout value below. 45s is generous
    // headroom over the small prompt's real cost, not a guess against the
    // full one. In production there is no listener on localhost:11434, so
    // the connection is refused immediately and this never actually waits
    // 45s there.
    const r = await callOpenAIShape(
      `${ollamaBase()}/v1/chat/completions`,
      model,
      opts?.ollamaMessages ?? messages,
      { timeoutMs: 45_000, maxTokens: 400 },
    );
    if (r.ok) return { reply: r.reply, provider: "ollama", model };
    failures.push(`Ollama (${model}): ${r.error}`);
  }

  return { error: `The assistant could not answer. ${failures.join(" | ")}` };
}
