import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chat } from "@/lib/assistant.providers";
import {
  DEBRIEF_SYSTEM_PROMPT,
  MAX_DEBRIEF_CHARS,
  parseModelFields,
  structureBuiltin,
  verifyAgainstText,
  type DebriefFields,
} from "@/lib/debrief";
import { createRateLimiter } from "@/lib/rate-limit";

/** Each call may spend a model request, so it is throttled like the assistant. */
const perClient = createRateLimiter({ limit: 6, windowMs: 60_000 });

export type StructuredDebrief = { fields: DebriefFields; structuredBy: string };

/**
 * Sort a written debrief into fields. A language model does it when one is
 * available; the built-in rules do it otherwise. Either way the result is
 * checked against the person's own text before it is returned, so a model
 * cannot add a placement, a number of hours or a judge's words that were
 * never written.
 */
export const structureDebrief = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        eventName: z.string().min(1).max(200),
        text: z.string().min(1).max(MAX_DEBRIEF_CHARS),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<StructuredDebrief | { error: string }> => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const client =
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestHeader("x-real-ip") ||
      "unknown";
    const verdict = perClient.check(client);
    if (!verdict.ok)
      return { error: `Too many requests just now. Try again in ${verdict.retryAfterSec}s.` };

    const builtin = (): StructuredDebrief => ({
      fields: structureBuiltin(data.text),
      structuredBy: "built-in rules",
    });

    const res = await chat([
      { role: "system", content: DEBRIEF_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Event: ${data.eventName}\n\n<ACCOUNT>\n${data.text.replace(/<\/ACCOUNT>/g, "")}\n</ACCOUNT>`,
      },
    ]);
    if ("error" in res) return builtin();

    const parsed = parseModelFields(res.reply);
    // A model that did not return usable JSON is not retried: the rules are
    // instant and the person is looking at a spinner.
    if (!parsed) return builtin();
    return { fields: verifyAgainstText(parsed, data.text), structuredBy: res.model };
  });
