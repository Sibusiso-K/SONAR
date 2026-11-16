# Models: what answers SONAR's questions, and how we know

Last measured: **16 November 2026**, against the board as synced that day.
Re-run with `cd web && bun run eval` (built-in engine only, free and instant)
or `OPENROUTER_API_KEY=… bun evals/run.ts --models a:free,b:free --out evals/results/<date>.json`.

## The chain

Every question goes down this list until something answers
(`web/src/lib/assistant.providers.ts`):

| # | Backend | Needs | Role |
|---|---|---|---|
| 1 | OpenRouter, free open-weight models, up to three tried | `OPENROUTER_API_KEY` | Reasoning across rows, drafting, open questions |
| 2 | Groq | `GROQ_API_KEY` (optional) | Second vendor, so one outage is not the assistant's |
| 3 | Ollama on the same machine | a local model; never on Vercel | Development and offline use |
| 4 | **Built-in engine** (`sonar-core-1`, `assistant.builtin.ts`) | nothing | Always answers. Looks the answer up in the rows; cannot invent a date |

Each reply in the panel says which one produced it. A lookup and a model's
reading of the same rows are different kinds of claim, and the reader should
not have to guess which they are holding.

The same order backs the **Monday sweep** (`scripts/monday_sweep.py`) and the
**debrief structurer** (`web/src/lib/debrief.functions.ts`), each with its own
built-in fallback. Whatever a model returns in those two is checked against
the source text by code before it is kept.

## Free models available (OpenRouter catalogue, 16 Nov 2026)

17 of 469 models were free. The text models relevant here:

| Model | Size (active / total) | Context | Tools | JSON mode | Notes |
|---|---|---|---|---|---|
| nvidia/nemotron-3-ultra-550b-a55b | 55B / 550B MoE | 1M | yes | no | Frontier reasoning, hybrid Mamba-Transformer |
| nvidia/nemotron-3.5-lightning | 3B / 30B MoE | 1M | yes | no | Built for throughput |
| google/gemma-4-31b-it | 31B dense | 262k | yes | yes | Shared upstream pool, often rate limited |
| google/gemma-4-26b-a4b-it | 4B / 26B MoE | 262k | yes | yes | Not yet measured |
| liquid/lfm-3-1.7b | 1.7B | 262k | yes | yes | Small; reasons before answering |
| baidu/ernie-5.5-flash-preview | 280B total | 1M | yes | yes | Preview; not yet measured |
| inclusionai/ling-3.2-flash | | 1M | yes | yes | Text and image; not yet measured |
| thinkingmachines/inkling-2-small | 17B / 594B MoE | 1M | yes | no | Not yet measured |
| cohere/north-mini-code, recursive/flint, particle-ai/particle-1 | | | | | Coding-agent models: wrong job for this |
| openrouter/free | router | | | | Picks a free model at random: unmeasurable, not used |

**Limits that shape the design.** An account that has never bought credits
gets **50 free-model requests a day** and 20 a minute; $10 of credit, once,
raises the daily cap to **1,000**. At 50 a day, a busy Monday of questions,
the sweep and a few debriefs can exhaust it. That is why the built-in engine
exists and why the chain falls through to it rather than to an error.

## The evaluation

Eight questions (`web/evals/cases.ts`), each probing one thing the assistant
is for, graded by rules a person can read (`web/evals/grade.ts`). No model
grades another. Every answer is also checked for **ungrounded dates**: any
day-and-month that appears nowhere on the board fails the answer, whatever
else it got right.

| Case | Probes | Right answer, from the frozen board |
|---|---|---|
| soonest | nearest deadline | Samsung programme, 22 Nov |
| countdown | days to a named deadline | Kiroween: 18 days |
| unconfirmed | admitting a missing date | FNB: no confirmed 2026 date |
| absent | refusing to invent | "Standard Bank Fintech Cup" is not on the board; no amount |
| score | explaining a score | Mintek: 82.5, career leverage 90 |
| prize | quoting money with currency | PayPal: $67,500 |
| archive | reading past results | IBM Dev Day: 3rd |
| scope | declining off-topic work | short refusal, no poem |

The board is frozen in `web/evals/board.snapshot.json` and the clock in
`cases.ts`, so "18 days" stays right whenever the run is repeated.

### Results

**Run 1: quality** (`evals/results/2026-11-16-run1-quality.json`;
max_tokens 1,500, no reasoning setting, 30,440-character prompt, about 9,900
prompt tokens)

| Engine | Passed | Answered | Ungrounded dates | Median reasoning tokens | Failed |
|---|---|---|---|---|---|
| **sonar-core-1** (built-in) | **8/8** | 8 | 0 | n/a | — |
| **nemotron-3-ultra** | **8/8** | 8 | 0 | 300 | — |
| nemotron-3.5-lightning | 7/8 | 7 | 0 | 848 | soonest (empty) |
| lfm-3-1.7b | 6/8 | 6 | 0 | 627 | soonest (empty), scope (429) |
| gemma-4-31b | 1/8 | 1 | 0 | 0 | 2 refused (429), then skipped |

**Run 2: latency** (`evals/results/2026-11-16-run2-latency.json`; max_tokens
3,000, reasoning effort low; timed to the whole answer)

| Engine | soonest | score | Median |
|---|---|---|---|
| sonar-core-1 | 3 ms | 2 ms | ~0 s |
| nemotron-3-ultra | 16.2 s | 16.7 s | 16.5 s |
| nemotron-3.5-lightning | empty (hit the cap) | 8.6 s | 8.6 s |
| lfm-3-1.7b | empty (hit the cap) | 429 | — |

### What the numbers say

1. **No model invented a date.** Zero ungrounded dates across 30 graded
   answers. The prompt's rules (never invent; say "unconfirmed" first) and
   giving every row its full list of dates are doing their job. The two
   "trap" cases (an unconfirmed date and an event that does not exist) were
   answered correctly by every model that answered at all.

2. **The failure mode of free models is silence, not lies.** Every miss was
   an empty reply or a refused request. The two small reasoning models spent
   their entire token budget thinking about the one open question ("what
   closes soonest?" means scanning 22 rows) and returned nothing, even at
   3,000 tokens with low effort. Those are caught (`returned nothing usable`)
   and the chain moves on.

3. **Nemotron 3 Ultra is the only free model that was right every time**,
   with the leanest reasoning (300 tokens median), but it takes about 16
   seconds. It leads the chain anyway: a correct answer in 16 seconds is
   worth more than a fast empty one, and the built-in engine has already
   covered the questions that need an instant answer.

4. **Availability matters as much as quality.** Gemma 4 31B answered the one
   question it was allowed to well, then its shared upstream pool refused the
   next two. A refusal costs about half a second, so it stays third in line,
   where it is a cheap extra try.

5. **The built-in engine matches the best model on the questions this
   assistant mostly gets.** It is a floor every model has to clear, not a
   competitor: it cannot draft prose or reason about something nobody
   anticipated, and it says so. What it buys is that the panel never ends on
   "the assistant could not answer".

6. **Formatting.** The large models answered with Markdown tables and bold
   text, which the panel shows as raw pipes and asterisks. The prompt now asks
   for plain text.

### Limits of this evaluation

Eight cases is a small sample: it can show a model is unusable, not rank two
good ones finely. It was kept small because 4 models × 8 cases is most of an
unfunded account's daily allowance. It measures lookups and refusals, not
drafting quality. Free endpoints vary by hour, so a model that refused today
may answer tomorrow; re-run before changing the order.

## Changing the model order

1. Check what still exists: `bun run eval:catalogue` (or look at
   `https://openrouter.ai/api/v1/models` for ids ending `:free`).
2. Run the evaluation with the candidates and save the result under
   `web/evals/results/`.
3. Set `OPENROUTER_MODELS` (comma-separated) in Vercel and, for the sweep,
   the `OPENROUTER_MODELS` repository variable. No code change needed.
4. If the new order should be the default, change `DEFAULT_OPENROUTER_MODELS`
   in `assistant.providers.ts` and `DEFAULT_MODELS` in
   `scripts/monday_sweep.py` together, and update the tables above.

## What else these models could do for SONAR

Ranked by value for effort, all within the free tier's limits:

| Idea | Model fit | Notes |
|---|---|---|
| Debrief structuring (built) | any; output verified against the text | Turns "how did it go" into retro fields |
| Monday sweep extraction (built) | Nemotron Ultra; JSON-capable Gemma as backup | Quotes verified on the page |
| Eligibility pre-check | Nemotron Ultra | Compare a row's eligibility text with `data/team_profile.json`; flag "age limit unread" style gaps |
| Brief-to-stack matching | Gemma 4 (tools, JSON) | Map a challenge brief to repos the team has already shipped |
| Reading poster images | Gemma 4 / Ling 3.2 (image input) | Many SA events are announced as images on social media; quote checking still applies |
| Weekly written digest | Nemotron Lightning | Turn the sweep and the board diff into a five-line Monday note |
