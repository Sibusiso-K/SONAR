import { describe, expect, it, vi } from "vitest";
import {
  chat,
  DEFAULT_OPENROUTER_MODELS,
  openRouterModels,
  shortModel,
  stripThinking,
  type ChatMessage,
} from "./assistant.providers";

const MESSAGES: ChatMessage[] = [
  { role: "system", content: "full prompt" },
  { role: "user", content: "What closes soonest?" },
];
const COMPACT: ChatMessage[] = [
  { role: "system", content: "compact prompt" },
  { role: "user", content: "What closes soonest?" },
];

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const status = (code: number) => new Response("{}", { status: code });

type Call = { url: string; model: string; system: string; auth: string | null };

/** A fetch that answers from a script, one entry per call, and records what it was sent. */
function scripted(...responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { model: string; messages: ChatMessage[] };
    calls.push({
      url: String(url),
      model: body.model,
      system: body.messages[0]!.content,
      auth: new Headers(init?.headers).get("authorization"),
    });
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra request");
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetch: impl as unknown as typeof fetch, calls };
}

const builtin = () => ({ reply: "from the rows", model: "sonar-core-1" });
// VERCEL set: no attempt on localhost unless a test asks for one.
const SERVERLESS = { VERCEL: "1" };

describe("chat", () => {
  it("answers from the first OpenRouter model when it responds", async () => {
    const net = scripted(ok("22 November."));
    const res = await chat(
      MESSAGES,
      { builtin },
      { env: { ...SERVERLESS, OPENROUTER_API_KEY: "k" }, fetch: net.fetch },
    );
    expect(res).toEqual({
      reply: "22 November.",
      provider: "openrouter",
      model: DEFAULT_OPENROUTER_MODELS[0],
      skipped: [],
    });
    expect(net.calls).toHaveLength(1);
    expect(net.calls[0]!.url).toContain("openrouter.ai");
    expect(net.calls[0]!.auth).toBe("Bearer k");
  });

  it("moves down the model list when one is rate limited", async () => {
    const net = scripted(status(429), ok("Second model."));
    const res = await chat(
      MESSAGES,
      { builtin },
      { env: { ...SERVERLESS, OPENROUTER_API_KEY: "k" }, fetch: net.fetch },
    );
    expect(res).toMatchObject({ provider: "openrouter", model: DEFAULT_OPENROUTER_MODELS[1] });
    expect("skipped" in res && res.skipped).toEqual([
      `${shortModel(DEFAULT_OPENROUTER_MODELS[0])}: rate limited`,
    ]);
  });

  it("treats a 200 that carries an error body as a failure, not an answer", async () => {
    const errorBody = new Response(JSON.stringify({ error: { code: 429, message: "x" } }), {
      status: 200,
    });
    const net = scripted(errorBody, ok("Recovered."));
    const res = await chat(
      MESSAGES,
      { builtin },
      { env: { ...SERVERLESS, OPENROUTER_API_KEY: "k" }, fetch: net.fetch },
    );
    expect(res).toMatchObject({ reply: "Recovered." });
  });

  it("treats an empty reply (a model that only reasoned) as a failure", async () => {
    const net = scripted(ok("<think>hmm</think>"), ok("Real answer."));
    const res = await chat(
      MESSAGES,
      { builtin },
      { env: { ...SERVERLESS, OPENROUTER_API_KEY: "k" }, fetch: net.fetch },
    );
    expect(res).toMatchObject({ reply: "Real answer." });
  });

  it("falls back to the built-in engine when every model fails", async () => {
    const net = scripted(status(429), status(503), new TypeError("fetch failed"));
    const res = await chat(
      MESSAGES,
      { builtin },
      { env: { ...SERVERLESS, OPENROUTER_API_KEY: "k" }, fetch: net.fetch },
    );
    expect(res).toMatchObject({
      reply: "from the rows",
      provider: "builtin",
      model: "sonar-core-1",
    });
    expect("skipped" in res && res.skipped).toHaveLength(3);
    // Never more than three attempts: a person is waiting.
    expect(net.calls).toHaveLength(3);
  });

  it("stops trying models once the time a person will wait has gone", async () => {
    // The first attempt "takes" 44 seconds; nothing is left for the others.
    let clock = 0;
    const net = scripted(status(503));
    const res = await chat(
      MESSAGES,
      { builtin },
      {
        env: { ...SERVERLESS, OPENROUTER_API_KEY: "k" },
        fetch: (async (...a: Parameters<typeof fetch>) => {
          clock += 44_000;
          return net.fetch(...a);
        }) as typeof fetch,
        now: () => clock,
      },
    );
    expect(res).toMatchObject({ provider: "builtin" });
    expect(net.calls).toHaveLength(1);
    expect("skipped" in res && res.skipped.filter((s) => /out of time/.test(s))).toHaveLength(2);
  });

  it("asks OpenRouter for low reasoning effort and room to answer", async () => {
    let sent: Record<string, unknown> = {};
    const res = await chat(
      MESSAGES,
      { builtin },
      {
        env: { ...SERVERLESS, OPENROUTER_API_KEY: "k" },
        fetch: (async (_url: unknown, init?: RequestInit) => {
          sent = JSON.parse(String(init?.body));
          return ok("Answer.");
        }) as typeof fetch,
      },
    );
    expect(res).toMatchObject({ reply: "Answer." });
    expect(sent).toMatchObject({ max_tokens: 3000, temperature: 0, reasoning: { effort: "low" } });
  });

  it("answers from the built-in engine with no keys at all, without touching the network", async () => {
    const net = scripted();
    const res = await chat(MESSAGES, { builtin }, { env: SERVERLESS, fetch: net.fetch });
    expect(res).toMatchObject({ provider: "builtin" });
    expect(net.calls).toHaveLength(0);
  });

  it("uses Groq as the second vendor when OpenRouter is exhausted", async () => {
    const net = scripted(status(429), status(429), status(429), ok("Groq answer."));
    const res = await chat(
      MESSAGES,
      { builtin },
      { env: { ...SERVERLESS, OPENROUTER_API_KEY: "k", GROQ_API_KEY: "g" }, fetch: net.fetch },
    );
    expect(res).toMatchObject({ provider: "groq", reply: "Groq answer." });
    expect(net.calls[3]!.url).toContain("api.groq.com");
    expect(net.calls[3]!.auth).toBe("Bearer g");
  });

  it("gives a local model the compact prompt, never the full one", async () => {
    const net = scripted(ok("Local answer."));
    const res = await chat(
      MESSAGES,
      { compactMessages: COMPACT, builtin },
      { env: {}, fetch: net.fetch },
    );
    expect(res).toMatchObject({ provider: "ollama" });
    expect(net.calls[0]!.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(net.calls[0]!.system).toBe("compact prompt");
  });

  it("does not look for a local model on a serverless host", async () => {
    const net = scripted();
    await chat(MESSAGES, { builtin }, { env: { VERCEL: "1" }, fetch: net.fetch });
    expect(net.calls).toHaveLength(0);
  });

  it("honours ASSISTANT_PROVIDER when pinned", async () => {
    const net = scripted();
    const res = await chat(
      MESSAGES,
      { builtin },
      { env: { OPENROUTER_API_KEY: "k", ASSISTANT_PROVIDER: "builtin" }, fetch: net.fetch },
    );
    expect(res).toMatchObject({ provider: "builtin", skipped: [] });
    expect(net.calls).toHaveLength(0);
  });

  it("reports what it tried when nothing can answer and no fallback was given", async () => {
    const net = scripted(status(500), status(500), status(500));
    const res = await chat(
      MESSAGES,
      {},
      { env: { ...SERVERLESS, OPENROUTER_API_KEY: "k" }, fetch: net.fetch },
    );
    expect("error" in res && res.error).toMatch(/could not answer/);
  });

  it("never puts an upstream error body in what the visitor sees", async () => {
    const leaky = new Response('{"error":"org_123 quota for key sk-secret exceeded"}', {
      status: 402,
    });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const net = scripted(leaky, status(402), status(402));
    const res = await chat(
      MESSAGES,
      { builtin },
      { env: { ...SERVERLESS, OPENROUTER_API_KEY: "k" }, fetch: net.fetch },
    );
    quiet.mockRestore();
    expect(JSON.stringify(res)).not.toMatch(/org_123|sk-secret/);
  });
});

describe("openRouterModels", () => {
  it("uses the measured default order", () => {
    expect(openRouterModels({})).toEqual([...DEFAULT_OPENROUTER_MODELS]);
  });

  it("is replaced, not extended, by OPENROUTER_MODELS", () => {
    expect(openRouterModels({ OPENROUTER_MODELS: " a/b:free , c/d:free ,," })).toEqual([
      "a/b:free",
      "c/d:free",
    ]);
  });

  it("ignores an empty override", () => {
    expect(openRouterModels({ OPENROUTER_MODELS: " , " })).toEqual([...DEFAULT_OPENROUTER_MODELS]);
  });

  it("only lists free variants by default: a paid id here would bill the account", () => {
    for (const id of DEFAULT_OPENROUTER_MODELS) expect(id).toMatch(/:free$/);
  });
});

describe("helpers", () => {
  it("strips inline reasoning", () => {
    expect(stripThinking("<think>scratch</think>\nAnswer.")).toBe("Answer.");
    expect(stripThinking("<THINKING>a\nb</THINKING>Answer.")).toBe("Answer.");
  });

  it("shortens model ids for display", () => {
    expect(shortModel("nvidia/nemotron-3.5-lightning:free")).toBe("nemotron-3.5-lightning");
    expect(shortModel("sonar-core-1")).toBe("sonar-core-1");
  });
});
