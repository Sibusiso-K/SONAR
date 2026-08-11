import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { winProbability, expectedValueUsd, collisions, daysUntil, toUsd } from "@/lib/analytics";
import type { Opportunity, PastOpportunity } from "@/lib/sonar-types";

export const askSonar = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(4000),
            }),
          )
          .min(1)
          .max(24),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) return { error: "The assistant is not configured yet." as const };

    const db = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const [oppRes, pastRes, updRes] = await Promise.all([
      db.from("opportunities").select("*").eq("archived", false),
      db.from("past_opportunities").select("*"),
      db.from("updates").select("*").order("created_at", { ascending: false }).limit(25),
    ]);

    const live = (oppRes.data ?? []) as unknown as Opportunity[];
    const past = (pastRes.data ?? []) as unknown as PastOpportunity[];

    const board = live
      .map((o) => {
        const wp = winProbability(o);
        return [
          `- ${o.name} (${o.id}) — ${o.organiser}, ${o.kind}, ${o.format}, ${o.scope}, tier ${o.tier}`,
          `  confidence=${o.confidence}; next_date=${o.next_date ?? "none"}${
            o.next_date ? ` (${daysUntil(o.next_date)} days away)` : ""
          }`,
          `  score=${o.score}; scores=${JSON.stringify(o.scores)}`,
          `  prize=${o.prize?.pool ?? 0} ${o.prize?.currency ?? "n/a"} (~$${toUsd(
            o.prize?.pool,
            o.prize?.currency,
          )}); breakdown=${o.prize?.breakdown ?? "unknown"}`,
          `  win_probability=${wp}/100; expected_value=$${expectedValueUsd(o)}`,
          `  career_track=${o.career_track}; source=${o.source ?? "unknown"}; went_live=${
            o.went_live_on ?? "unknown"
          }; noticed=${o.noticed_on ?? "never"}`,
          `  eligibility: ${o.eligibility ?? "not recorded"}`,
          `  what_to_build: ${o.what_to_build ?? "not recorded"}`,
          `  deliverables: ${o.deliverables ?? "not recorded"}`,
          `  notes: ${o.notes ?? "none"}`,
        ].join("\n");
      })
      .join("\n");

    const clashes = collisions(live)
      .map((c) => `- Week of ${c.weekLabel}: ${c.items.map((i) => i.name).join(" + ")}`)
      .join("\n");

    const archive = past
      .map(
        (p) =>
          `- ${p.name} (${p.happened_on ?? "date unknown"}): ${p.outcome}${
            p.placement ? ` — ${p.placement}` : ""
          }${p.corrected ? ` [CORRECTED: ${p.correction_note}]` : ""}`,
      )
      .join("\n");

    const recent = (updRes.data ?? [])
      .map(
        (u: { created_at: string; actor: string; summary: string }) =>
          `- ${u.created_at.slice(0, 10)} ${u.actor}: ${u.summary}`,
      )
      .join("\n");

    const system = [
      "You are SONAR's in-board assistant. SONAR is a two-person opportunity tracker for hackathons, competitions, grad programmes and recruiting events.",
      "Voice: dry, precise, a little wry. Never cheerful startup filler. Short paragraphs, no emoji, no exclamation marks.",
      "",
      "HARD RULES:",
      "1. Never invent a date, prize, result, deadline or eligibility rule. If it is not in the data below, say plainly that the board does not have it and name what would need to be verified.",
      "2. When a row is 'unconfirmed', 'predicted' or 'conflicted', say so before you reason from it. Never present it as calendar-safe.",
      "3. Win probability and expected value below are derived from board data. Quote them as rough ranking devices, not forecasts.",
      "4. Stay in scope: prioritisation, explaining scores, drafting submission checklists and eligibility summaries from the recorded fields, and flagging conflicts or stale rows. Decline unrelated requests in one sentence.",
      "",
      "LIVE BOARD:",
      board || "(empty)",
      "",
      "DETECTED DEADLINE COLLISIONS:",
      clashes || "(none detected)",
      "",
      "PAST AND MISSED:",
      archive || "(empty)",
      "",
      "RECENT AUDIT TRAIL:",
      recent || "(empty)",
      "",
      `Today is ${new Date().toISOString().slice(0, 10)}.`,
    ].join("\n");

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-r1-distill-llama-70b",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (res.status === 429) return { error: "Rate limited. Give it a minute." as const };
    if (!res.ok) {
      return { error: `The assistant call failed (${res.status}).` as const };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) return { error: "The model returned nothing usable." as const };
    return { reply };
  });
