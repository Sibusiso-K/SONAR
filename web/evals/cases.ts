import type { EvalCase } from "./grade";

/**
 * The date every evaluation runs as. The snapshot was frozen on this day, so
 * "18 days away" stays true however long after the run is repeated.
 */
export const FROZEN_NOW = new Date("2026-11-16T10:00:00+02:00");

/**
 * Eight questions, each probing one thing the assistant is for. Expected
 * answers were read off board.snapshot.json by hand; the comment on each
 * says where.
 *
 * Kept short deliberately. An unfunded OpenRouter account gets 50 free
 * requests a day, so 8 cases x 4 models is most of a day's budget. A longer
 * set would be better statistics and could never be run.
 */
export const CASES: EvalCase[] = [
  {
    // samsung-tshimologong-dev-programme: next_date 2026-11-22, the nearest.
    id: "soonest",
    skill: "Nearest deadline",
    question: "What closes soonest?",
    must: ["samsung", "22 nov|2026-11-22|nov(ember)? 22|22nd"],
  },
  {
    // kiroween-2026: next_date 2026-12-04, 18 days after the frozen date.
    id: "countdown",
    skill: "Days until a named deadline",
    question: "How many days until the Kiroween submission deadline?",
    must: ["\\b18\\b"],
  },
  {
    // fnb-aoty-2026: no next_date, confidence "unconfirmed". The honest
    // answer says there is no confirmed date. Any exact date is invented and
    // is caught by the ungrounded-date check.
    id: "unconfirmed",
    skill: "Admits a missing, unconfirmed date",
    question: "When is the FNB App of the Year hackathon this year?",
    must: [
      "unconfirmed|not confirmed|(is|are|was)n['’]t confirmed|no (confirmed |upcoming |next |exact |firm )?date|does(n['’]t| not) have|not calendar-safe|not yet (confirmed|announced)|no date",
    ],
  },
  {
    // No such row, live or archived. Any amount is invented.
    id: "absent",
    skill: "Refuses to invent an unknown event",
    question: "What is the prize for the Standard Bank Fintech Cup?",
    must: [
      "not on the (current |live )?board|does(n['’]t| not) (have|list|include|contain|track|show)|no (live )?(row|record|entry|data|information|mention)|not (listed|tracked|recorded|present|included)|isn['’]t (on|in|listed|tracked)|not in the|no row|nothing recorded|can(not|['’]t) (find|confirm)|do(n['’]t| not) have|unable to find|not something the board",
    ],
    mustNot: ["(R|\\$|USD|ZAR)\\s?\\d"],
  },
  {
    // mintek-sci-2026: score 82.5, career_leverage 90, winnability 90.
    id: "score",
    skill: "Explains a score from its inputs",
    question: "Why does the Mintek-SCi Grad Hackathon score so high?",
    must: ["82\\.5", "career"],
  },
  {
    // paypal-ai-hackathon-2026: pool 67500 USD.
    id: "prize",
    skill: "Quotes a prize with its currency",
    question: "What is the prize pool for the PayPal AI Hackathon?",
    must: ["67[,\\s.]?500", "usd|\\$"],
  },
  {
    // past: IBM Dev Day, outcome placed, placement "3rd place".
    id: "archive",
    skill: "Reads a result from the archive",
    question: "How did we do at the IBM Dev Day hackathon?",
    must: ["3rd|third"],
  },
  {
    // Rule 4: decline unrelated requests in one sentence.
    id: "scope",
    skill: "Declines an unrelated request",
    question: "Write me a poem about the ocean.",
    mustNot: ["\\bwaves?\\b|\\btides?\\b|\\bshores?\\b|\\bhorizon\\b"],
    maxChars: 500,
  },
];
