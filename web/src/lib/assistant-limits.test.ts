import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGE_CHARS,
  MAX_MESSAGES,
  MAX_TOTAL_CHARS,
  SENT_CHAR_BUDGET,
  SENT_MESSAGES,
  fitConversation,
  type ChatTurn,
} from "./assistant-limits";

const total = (m: ChatTurn[]) => m.reduce((n, x) => n + x.content.length, 0);
const turn = (role: ChatTurn["role"], n: number): ChatTurn => ({ role, content: "x".repeat(n) });

/** A back-and-forth of `pairs` question/answer turns. */
function chat(pairs: number, askLen: number, replyLen: number): ChatTurn[] {
  return Array.from({ length: pairs }, () => [
    turn("user", askLen),
    turn("assistant", replyLen),
  ]).flat();
}

describe("limits are consistent", () => {
  it("keeps the client budget under the server ceiling", () => {
    expect(SENT_MESSAGES).toBeLessThan(MAX_MESSAGES);
    expect(SENT_CHAR_BUDGET).toBeLessThan(MAX_TOTAL_CHARS);
    expect(MAX_MESSAGE_CHARS).toBeLessThanOrEqual(SENT_CHAR_BUDGET);
  });
});

describe("fitConversation", () => {
  it("returns an empty list for no messages", () => {
    expect(fitConversation([])).toEqual([]);
  });

  it("passes a short conversation through unchanged", () => {
    const m = chat(2, 50, 200);
    expect(fitConversation(m)).toEqual(m);
  });

  it("never exceeds the message count the client sends", () => {
    expect(fitConversation(chat(40, 5, 5)).length).toBeLessThanOrEqual(SENT_MESSAGES);
  });

  it("stays within the character budget however long the replies are", () => {
    // 30 turns of long answers: the case that broke a count-only trim.
    const fitted = fitConversation(chat(30, 300, 3600));
    expect(total(fitted)).toBeLessThanOrEqual(SENT_CHAR_BUDGET);
  });

  it("always passes the server's own validation limits", () => {
    for (const [pairs, ask, reply] of [
      [3, 4000, 4000],
      [12, 800, 3600],
      [50, 10, 10],
      [1, 5000, 0],
    ] as const) {
      const fitted = fitConversation(chat(pairs, ask, reply));
      expect(fitted.length).toBeLessThanOrEqual(MAX_MESSAGES);
      expect(total(fitted)).toBeLessThanOrEqual(MAX_TOTAL_CHARS);
      for (const x of fitted) expect(x.content.length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
    }
  });

  it("keeps the newest message, which is the question being asked", () => {
    const m = [...chat(10, 3000, 3000), { role: "user" as const, content: "latest question" }];
    const fitted = fitConversation(m);
    expect(fitted[fitted.length - 1]!.content).toBe("latest question");
  });

  it("keeps the most recent turns, not the oldest", () => {
    const m: ChatTurn[] = [];
    for (let i = 0; i < 30; i++) m.push({ role: i % 2 ? "assistant" : "user", content: `m${i}` });
    const fitted = fitConversation(m);
    expect(fitted[fitted.length - 1]!.content).toBe("m29");
    expect(fitted.some((x) => x.content === "m0")).toBe(false);
  });

  it("shortens a single oversized message instead of rejecting it", () => {
    const fitted = fitConversation([turn("user", 9_000)]);
    expect(fitted).toHaveLength(1);
    expect(fitted[0]!.content.length).toBe(MAX_MESSAGE_CHARS);
  });

  it("does not start the history with an assistant turn", () => {
    const m: ChatTurn[] = [
      turn("user", 3900),
      turn("assistant", 3900),
      turn("user", 3900),
      turn("assistant", 3900),
      turn("user", 100),
    ];
    const fitted = fitConversation(m);
    expect(fitted[0]!.role).toBe("user");
  });
});
