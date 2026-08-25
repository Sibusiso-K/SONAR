import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import {
  winProbability,
  expectedValueUsd,
  collisions,
  confidenceTrend,
  daysUntil,
  discoveryLag,
  seasonStats,
  toUsd,
} from "@/lib/analytics";
import { participationBadge } from "@/lib/participation";
import { chat } from "@/lib/assistant.providers";
import { BENCHMARK, PLAYBOOK, gapToLeaderPct } from "@/lib/playbook";
import type { Opportunity, PastOpportunity, UpdateRow } from "@/lib/sonar-types";

/**
 * Caps a field at n characters. Exists because the full board data,
 * uncapped, builds a system prompt of roughly 12,400 tokens against Groq's
 * 8,000 TPM ceiling on this account's tier — measured against the live
 * board, not estimated. A first pass at trimming (140/160/100/200-char
 * caps) still measured 8,155 real prompt tokens a few hours later, because
 * the board keeps growing: it is not a one-time fix, it is a budget that
 * shrinks every time an entry or an update is added. These caps (~half of
 * the first pass) measured 6,029 real prompt tokens against the live board
 * on 25 Aug 2026 — confirmed against Groq's own usage figures, not
 * estimated — leaving roughly 2,000 tokens of headroom for the board to
 * keep growing before this needs revisiting again. Truncating loses
 * detail, not accuracy: the assistant's hard rule against inventing facts
 * already covers a field it cannot see in full the same way it covers a
 * field that is empty.
 */
function truncate(s: string | null | undefined, n: number) {
  if (!s) return "none";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

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
    // No GROQ_API_KEY check here any more: a missing key is no longer fatal,
    // because a running local Ollama can answer on its own. Which backends
    // are actually available is decided in assistant.providers, and if none
    // are it reports which ones it tried and why each failed.

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

    const live = (oppRes.data ?? []) as unknown as Opportunity[];
    const past = (pastRes.data ?? []) as unknown as PastOpportunity[];
    const updates = (updRes.data ?? []) as unknown as UpdateRow[];

    const board = live
      .map((o) => {
        const wp = winProbability(o);
        return [
          `- ${o.name} (${o.id}) — ${o.organiser}, ${o.kind}, ${o.format}, ${o.scope}, tier ${o.tier}`,
          `  confidence=${o.confidence}; participation=${participationBadge(o.status).label}; next_date=${o.next_date ?? "none"}${
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
          `  eligibility: ${truncate(o.eligibility, 90)}`,
          `  what_to_build: ${truncate(o.what_to_build, 100)}`,
          `  deliverables: ${truncate(o.deliverables, 60)}`,
          `  notes: ${truncate(o.notes, 120)}`,
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

    const recent = updates
      .map((u) => `- ${u.created_at.slice(0, 10)} ${u.actor}: ${u.summary}`)
      .join("\n");

    // Everything /stats derives from the same three tables, computed here
    // so the assistant can answer "what does stats say" without the user
    // having to go look — the whole site, not just the board rows.
    const season = seasonStats(live, past);
    const lag = discoveryLag(live)
      .map(
        (s) =>
          `- ${s.source}: avg ${s.avgLagDays}d, worst ${s.worstLagDays}d, ${s.tracked} tracked${
            s.unnoticed > 0 ? `, ${s.unnoticed} never noticed` : ""
          }`,
      )
      .join("\n");
    const trend = confidenceTrend(live, updates);
    const confidenceMix = trend.counts.map((c) => `${c.name}=${c.value}`).join(", ");

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
      "SEASON SUMMARY (same numbers as /stats):",
      `tracked prize pool $${season.totalPoolUsd}; discovered=${season.discovered}, entered=${season.entered}, won=${season.won}, placed=${season.placed}, missed=${season.missed}; avg discovery lag ${season.avgLag}d`,
      `confidence mix: ${confidenceMix || "none"}; ${trend.calendarSafe} of ${live.length} are calendar-safe (confirmed)`,
      "",
      "DISCOVERY LAG BY SOURCE:",
      lag || "(no lag data yet)",
      "",
      "PLAYBOOK (the /playbook section on the board page: researched, source-traced rules for",
      "how these competitions get won. arena=scored means leaderboard contests, arena=judged",
      "means pitched/judged events, and the two reward different behaviour. evidence=ours means",
      "this team measured it; evidence=external means somebody else published it):",
      PLAYBOOK.map(
        (p) =>
          `- [${p.phase}/${p.arena}/${p.evidence}] ${p.claim} ${truncate(p.detail, 90)} (source: ${p.source})`,
      ).join("\n"),
      "",
      "OUR MEASURED COMPETITION BASELINE:",
      `${BENCHMARK.event} (${BENCHMARK.date}): scored ${BENCHMARK.ourScore}, leader ${BENCHMARK.leaderScore}, ` +
        `${gapToLeaderPct()}% behind at leaderboard freeze, standing ${BENCHMARK.standing} ` +
        `(NOT confirmed - the portal closed its leaderboard and keeps no history, so never state this as a final rank).`,
      "",
      `Today is ${new Date().toISOString().slice(0, 10)}.`,
    ].join("\n");

    // Ollama gets a deliberately smaller prompt, not the same one truncated
    // by the server. Measured on 25 Aug 2026: the full prompt above (~7,450
    // tokens) forced a choice between two bad options on this CPU-only box.
    // Ollama's default 2048-token context window silently drops whatever
    // does not fit, so sending the full prompt at default settings answered
    // in 8 seconds but the model was reasoning over roughly a quarter of
    // the real data and returned an ungrounded, made-up date. Explicitly
    // widening the context to 8192 so nothing is silently dropped fixed
    // the correctness problem but the same request then took over 200
    // seconds. Neither is acceptable for a page waiting on the answer, and
    // silently truncating is worse than either: it produces a confident,
    // wrong reply instead of a slow or absent one, which is exactly what
    // this assistant's own hard rules exist to prevent. So instead of one
    // prompt force-fit to two very different backends, this is a second,
    // honestly smaller one: nearest deadlines only, no eligibility, notes,
    // playbook or audit trail, small enough for Ollama's default context
    // to hold in full. It knows less, on purpose, and says so.
    const nearestLive = [...live]
      .filter((o) => o.next_date)
      .sort((a, b) => (daysUntil(a.next_date) ?? 9999) - (daysUntil(b.next_date) ?? 9999))
      .slice(0, 10)
      .map(
        (o) =>
          `- ${o.name}: next_date=${o.next_date} (${daysUntil(o.next_date)} days away), ` +
          `confidence=${o.confidence}, participation=${participationBadge(o.status).label}, ` +
          `prize=${o.prize?.pool ?? 0} ${o.prize?.currency ?? "n/a"}, score=${o.score}`,
      )
      .join("\n");

    const ollamaSystem = [
      "You are SONAR's in-board assistant, running in a reduced-data fallback mode.",
      "Voice: dry, precise, a little wry. Never cheerful startup filler. Short paragraphs, no emoji, no exclamation marks.",
      "",
      "HARD RULES:",
      "1. Never invent a date, prize, result, deadline or eligibility rule. If it is not in the data below, say plainly that this reduced view does not have it.",
      "2. You are only given the 10 nearest live deadlines, with no eligibility, notes, deliverables or playbook detail. If asked for any of that, say this fallback mode does not carry it and suggest trying again shortly.",
      "3. When a row is 'unconfirmed', 'predicted' or 'conflicted', say so before you reason from it.",
      "",
      "NEAREST LIVE DEADLINES:",
      nearestLive || "(none with a recorded date)",
      "",
      `Today is ${new Date().toISOString().slice(0, 10)}.`,
    ].join("\n");

    // Provider selection, retries and <think>-stripping all live in
    // assistant.providers. Groq gets the full prompt and answers when it
    // can; the local Ollama box gets the reduced one and covers the
    // offline/rate-limited case. Errors from every backend tried are
    // surfaced together rather than collapsed to a status code, which is
    // what previously hid "model decommissioned" behind a redeploy
    // guessing game.
    return await chat([{ role: "system", content: system }, ...data.messages], {
      ollamaMessages: [{ role: "system", content: ollamaSystem }, ...data.messages],
    });
  });
