/**
 * Grading for assistant evaluations. No model judges another model here:
 * every check is a rule a person can read, so a score means the same thing
 * next month as it does today.
 *
 * Three checks per answer:
 *   - `must`: facts the answer has to contain (each entry is a regular
 *     expression; all of them have to match).
 *   - `mustNot`: things it must not say.
 *   - ungrounded dates: any calendar date in the answer that appears nowhere
 *     in the board snapshot. This is the hallucination the assistant's first
 *     rule exists to prevent, and it is checked on every case, not only the
 *     ones written to provoke it.
 */

export type EvalCase = {
  id: string;
  /** What the case is probing, for the results table. */
  skill: string;
  question: string;
  must?: string[];
  mustNot?: string[];
  /** Upper bound on answer length, for cases where the right answer is short. */
  maxChars?: number;
};

export type Grade = {
  pass: boolean;
  missing: string[];
  violations: string[];
  ungroundedDates: string[];
  tooLong: boolean;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RX = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";

function key(month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Every day-and-month a text mentions, as "MM-DD". The year is ignored on
 * purpose: "4 Dec" and "2026-12-04" are the same claim. Times are not dates:
 * "12 Nov 22:00" is the 12th, not also "Nov 22".
 */
export function datesIn(text: string): Set<string> {
  const found = new Set<string>();
  const add = (k: string | null) => k && found.add(k);
  const lower = text.toLowerCase();

  for (const m of lower.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    add(key(Number(m[2]), Number(m[3])));
  }
  // "4 Dec", "4th of December"
  for (const m of lower.matchAll(
    new RegExp(`(?<![\\d:.-])(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+${MONTH_RX}`, "g"),
  )) {
    add(key(MONTHS.indexOf(m[2]!) + 1, Number(m[1])));
  }
  // "Dec 4", "December 4th" — but not the "Nov 22" inside "12 Nov 22:00",
  // and not "Dec 2026".
  for (const m of lower.matchAll(
    new RegExp(
      `(?<!\\d\\s)(?<!\\d(?:st|nd|rd|th)\\s)\\b${MONTH_RX}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?![\\d:])`,
      "g",
    ),
  )) {
    add(key(MONTHS.indexOf(m[1]!) + 1, Number(m[2])));
  }
  return found;
}

export function grade(reply: string, c: EvalCase, groundTruthText: string): Grade {
  const missing = (c.must ?? []).filter((rx) => !new RegExp(rx, "i").test(reply));
  const violations = (c.mustNot ?? []).filter((rx) => new RegExp(rx, "i").test(reply));
  const allowed = datesIn(groundTruthText);
  const ungroundedDates = [...datesIn(reply)].filter((d) => !allowed.has(d));
  const tooLong = c.maxChars !== undefined && reply.length > c.maxChars;
  return {
    pass:
      missing.length === 0 && violations.length === 0 && ungroundedDates.length === 0 && !tooLong,
    missing,
    violations,
    ungroundedDates,
    tooLong,
  };
}
