import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { chat } from "@/lib/assistant.providers";
import { answerBuiltin, BUILTIN_MODEL } from "@/lib/assistant.builtin";
import { buildCompactPrompt, buildSystemPrompt, type BoardSnapshot } from "@/lib/assistant.context";
import { createRateLimiter } from "@/lib/rate-limit";
import { MAX_MESSAGES, MAX_MESSAGE_CHARS, MAX_TOTAL_CHARS } from "@/lib/assistant-limits";
import type { Opportunity, PastOpportunity, UpdateRow } from "@/lib/sonar-types";

/**
 * Two brakes, both per warm server instance (see lib/rate-limit.ts): a
 * per-client cap so one visitor cannot hammer the endpoint, and a global cap
 * so the total spend per minute is bounded however many clients there are.
 * Each answer costs ~6,000 prompt tokens. The free model tier allows 20
 * requests a minute and 50 a day on an unfunded account, so the global cap
 * sits under the per-minute figure; the daily one is enforced upstream and
 * shows up here as a fall-through to the built-in engine.
 */
const perClientLimit = createRateLimiter({ limit: 6, windowMs: 60_000 });
const globalLimit = createRateLimiter({ limit: 18, windowMs: 60_000 });

export const askSonar = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(MAX_MESSAGE_CHARS),
            }),
          )
          .min(1)
          .max(MAX_MESSAGES),
      })
      .refine((d) => d.messages.reduce((n, m) => n + m.content.length, 0) <= MAX_TOTAL_CHARS, {
        message: `Conversation too long (over ${MAX_TOTAL_CHARS} characters).`,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    // Throttle before doing any work. The client key is the first hop of
    // X-Forwarded-For, which the hosting edge sets (a client cannot choose
    // it on Vercel); "unknown" shares one bucket rather than bypassing it.
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const clientKey =
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestHeader("x-real-ip") ||
      "unknown";
    const mine = perClientLimit.check(clientKey);
    const all = globalLimit.check("all");
    if (!mine.ok || !all.ok) {
      const wait = Math.max(mine.ok ? 0 : mine.retryAfterSec, all.ok ? 0 : all.retryAfterSec);
      return { error: `Too many questions just now. Try again in ${wait}s.` as const };
    }

    // No API-key check here: a missing key is not fatal. Which backends are
    // available is decided in assistant.providers, and the built-in engine
    // answers when none of the language models can.

    // Vercel only has the VITE_-prefixed vars set (they're also read
    // client-side, see integrations/supabase/client.ts) — this project
    // never had a plain SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY configured
    // there, so fall back to those rather than assuming a second copy exists.
    const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
    const supabaseKey =
      process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (!supabaseUrl || !supabaseKey) {
      return { error: "The assistant is not configured yet." as const };
    }

    const db = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [oppRes, pastRes, updRes] = await Promise.all([
      db.from("opportunities").select("*").eq("archived", false),
      db.from("past_opportunities").select("*"),
      // 10, not 25: the prompt only ever used u.summary (the short title),
      // never u.detail, so this section was never the dominant cost — the
      // board section below is. Trimmed anyway since 25 titles buys little
      // over 10 and every token here is one the board section needs more.
      db.from("updates").select("*").order("created_at", { ascending: false }).limit(10),
    ]);

    // `data ?? []` on a failed query looks identical to a genuinely empty
    // board - the model would then confidently answer "nothing is open
    // right now" from a database error, not from reality
    // (docs/REVIEW_2026-09-14.md, finding 6). The live board is the one
    // read this whole feature is useless without, so stop rather than
    // silently reason from nothing; past_opportunities and updates are
    // supplementary context, so a failure there is noted in the prompt
    // instead of failing the whole request.
    if (oppRes.error) {
      // The database's own message can name tables and columns; keep it in
      // the server log and give the visitor the part they can act on.
      console.error("[assistant] board read failed:", oppRes.error.message);
      return {
        error:
          "Couldn't read the board right now. Not answering from an empty result — try again shortly." as const,
      };
    }

    const snapshot: BoardSnapshot = {
      live: (oppRes.data ?? []) as unknown as Opportunity[],
      past: (pastRes.data ?? []) as unknown as PastOpportunity[],
      updates: (updRes.data ?? []) as unknown as UpdateRow[],
      pastUnavailable: Boolean(pastRes.error),
      updatesUnavailable: Boolean(updRes.error),
    };

    // Backend selection, the model list and <think>-stripping live in
    // assistant.providers. A language model gets the full prompt; a local
    // model gets the compact one; and if none of them answers (no key, daily
    // quota spent, upstream down) the built-in engine reads the same rows
    // and answers directly, so the panel never ends on a provider error.
    return await chat(
      [{ role: "system", content: buildSystemPrompt(snapshot) }, ...data.messages],
      {
        compactMessages: [
          { role: "system", content: buildCompactPrompt(snapshot) },
          ...data.messages,
        ],
        builtin: () => ({
          reply: answerBuiltin(data.messages, snapshot).reply,
          model: BUILTIN_MODEL,
        }),
      },
    );
  });
