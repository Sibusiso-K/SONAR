/**
 * Size limits for assistant conversations, shared by the server's validator
 * (assistant.functions.ts) and the client that builds the request
 * (components/Assistant.tsx).
 *
 * They live in one place because the two sides must agree. When the client
 * only trimmed by message count, a long conversation grew past the server's
 * size ceiling and every later send failed validation until the page was
 * reloaded. The client now fits its history to a budget below the ceiling.
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** The server rejects anything beyond these. */
export const MAX_MESSAGES = 24;
export const MAX_MESSAGE_CHARS = 4_000;
/** Across the whole conversation: bounds the prompt and the spend per call. */
export const MAX_TOTAL_CHARS = 16_000;

/** What the client sends. Deliberately under the ceiling so a slow request
 * racing a fast one still validates. */
export const SENT_MESSAGES = 20;
export const SENT_CHAR_BUDGET = 14_000;

/**
 * The most recent part of a conversation that fits the budget.
 *
 * Always keeps the newest message (the question being asked), shortening it if
 * it alone is over the per-message limit; then adds older turns, newest
 * first, until the count or character budget is spent. Drops any leading
 * assistant turn so the history starts with the user.
 */
export function fitConversation(messages: readonly ChatTurn[]): ChatTurn[] {
  if (messages.length === 0) return [];

  const last = messages[messages.length - 1]!;
  const newest: ChatTurn = { role: last.role, content: last.content.slice(0, MAX_MESSAGE_CHARS) };

  const kept: ChatTurn[] = [newest];
  let chars = newest.content.length;

  for (let i = messages.length - 2; i >= 0 && kept.length < SENT_MESSAGES; i--) {
    const m = messages[i]!;
    const content = m.content.slice(0, MAX_MESSAGE_CHARS);
    if (chars + content.length > SENT_CHAR_BUDGET) break;
    kept.unshift({ role: m.role, content });
    chars += content.length;
  }

  while (kept.length > 1 && kept[0]!.role === "assistant") kept.shift();
  return kept;
}
