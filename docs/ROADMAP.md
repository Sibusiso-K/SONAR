# SONAR — where everything wires in

Answers "where do I plug in X" with file paths, not gestures. Written
2026-08-12. Read `docs/STATUS.md` first for what already runs.

Ordering principle throughout: **deterministic before probabilistic,
cheap before expensive, and never a number we can't defend.**

---

## 1. Bright Data — the expensive tier, fired last

**Where:** new `scripts/providers/brightdata.py`, called from
`scripts/watch_sources.py` as a fallback, never as the default.

The architecture in `docs/AUTONOMY.md` tiers sources A–E by cost. Bright
Data is tier C/D — SERP fan-out and social scraping. It should fire *only*
when the free tiers come up empty, because the cost control is already
built and currently has nothing to control:

- `sources.cost_class` (`free` / `serp` / `unlocker` / `browser` / `social`)
- `source_runs.cost_usd` + `committed`
- the `v_source_yield` view, whose `cost_per_commit` column is the number
  that decides whether a feed stays switched on

**Gate to implement:** an org gets a Bright Data sweep only if its cheap
sources have produced zero candidates for N consecutive runs, or if it sits
inside a `predictions` watch window (i.e. we expect an announcement now).
Write `cost_usd` on every run; kill any source whose `cost_per_commit`
stays null after a month.

**What it's actually for**, in priority order:
1. Career/news pages behind bot protection that plain `urllib` can't fetch
   (already hit this: `api.groq.com` 403'd on a missing User-Agent — real
   corporate sites are worse).
2. LinkedIn org posts — the single highest-value social source for SA
   corporate hackathon announcements.
3. SERP fan-out for niche/unknown organisers, last.

## 2. AIsa.one — reserved for what Groq physically cannot do

**Where:** new `scripts/providers/aisa.py`.

Groq is inference-only: fast, free-refilling, no web access. AIsa's value
here is its *data endpoints*, not its models — X/Twitter, Perplexity,
Tavily. Spend the $5 credit only on those. Never route bulk extraction
through it.

Model routing, given what's on the account (`qwen-flash`,
`qwen3.7-flash`, `z-ai/glm-5v-turbo`):
- **Groq** — all bulk extraction (`watch_sources.py`) and the chat
  assistant. Free tier, daily refill, already wired.
- **AIsa `qwen-flash`** — only when a lookup needs AIsa's own data
  endpoints in the same call.
- **AIsa `glm-5v-turbo`** (vision) — held back for genuinely image-only
  sources: a poster or flyer where the date exists only as pixels. Costs
  more per call; most sources are HTML.

## 3. Groq — already wired twice, one gap

Live now in `scripts/watch_sources.py` (extraction, `llama-3.1-8b-instant`)
and `web/src/lib/assistant.functions.ts` (chat,
`deepseek-r1-distill-llama-70b`).

**The gap:** nothing promotes a verified `observation` into
`data/opportunities.json`. Evidence accumulates in Supabase and a human
must notice it. That promotion step — draft a JSON entry from verified
observations, open it as a PR for review — is the highest-value remaining
autonomy work, and it's a Groq job.

## 4. Data science / ML — honest tiering

The distinction that matters: **which of these can be computed today
without inventing a number.**

### Tier 0 — deterministic, buildable now, no training data required
- **Date forecasting for undated events.** *Already built* —
  `sonar_db.py forecast`, circular-mean day-of-year (handles the Dec/Jan
  wrap). It produces nothing today for one reason only: the `editions`
  table is empty. **The unlock is backfilling prior-year dates**, not more
  code. Six board entries are undated and recurring (FNB AOTY, Geekulcha,
  Huawei ICT, MTN MoMo, Mintek, Discovery Gradhack). Two prior editions
  each turns every one of them into a watch window that fires months
  early — which is the entire Gradhack lesson.
- **Capability match** — does this challenge need a stack we've actually
  shipped? Computed from real repo history (see §5).
- **Effort feasibility** — is the window long enough given our *observed*
  build velocity, not our optimism?
- **Deadline collisions** — already live on `/stats`.

### Tier 1 — needs ~5+ recorded outcomes
Win-probability *calibration*. The current `winProbability()` in
`web/src/lib/analytics.ts` is explicitly a ranking device, and its own
blurb says to treat a four-point gap as noise. That's the correct posture
until outcomes exist. **We have one** (Gradhack Top 6). Do not fit
anything to it.

### Tier 2 — needs ~10+ outcomes with retros
"What idea should we build to win this." Genuinely valuable, genuinely not
possible yet. What makes it possible later is capturing retros *now* —
hence `data/retros.json` (§5).

**The rule:** a model that outputs a confident number from one data point
is worse than no model. Everything in Tier 1/2 stays off until the data
justifies it, and the UI should say *why* it's off rather than showing an
empty chart.

## 5. Learning from our own builds — the actually-novel part

Nobody else can build this, because nobody else has your history. It's the
strongest idea in the whole request.

**Real data that exists today** (verified via the GitHub API, not assumed):
13 repos, of which two map directly onto board entries — `KHANYA` →
`mintek-sci-2026`, `RSNA-Knee-Abnormality-Detection` → `rsna-knee-2026`.
Language split: Python ×4, TypeScript ×2, JavaScript, Dart, HTML.

**What that yields deterministically:**
- **Stack fingerprint** — Python for ML/data, TS/JS for web, Dart for
  mobile. Tells you which challenge types are executable at all.
- **Measured lead time** — a competition repo's `created_at` against that
  opportunity's deadline is real, observed prep time. RSNA's repo was
  created 8 Aug; that's a fact, not a self-report.
- **Sustained-effort window** — `created_at` → `pushed_at` span is how long
  a project actually holds attention.

**Built:** `scripts/build_team_profile.py` → `data/team_profile.json`, and
`capability_match()` scoring each opportunity against the profile.

**Still to capture — `data/retros.json`:** one entry per entered
competition: what we built, stack, hours, placement, what went wrong, what
we'd reuse. This is the file that makes Tier 1/2 possible later. It has to
be written by hand right after each event, while it's fresh — nothing can
infer "we lost three hours to a broken auth flow" from a commit log.

## 6. The globe — from decoration to instrument

`web/src/components/EventGlobe.tsx` + `web/src/lib/eventLocations.ts`.

The existing venue-vs-HQ distinction (solid vs hollow markers, "never guess
a city we're not confident about") is genuinely good and should survive any
rework.

Worth adding, roughly in value order:
1. **Click a marker → open that opportunity.** Currently the globe shows
   but doesn't route.
2. **Great-circle arcs from Johannesburg** to each in-person event, with
   the arc weighted by urgency. Turns "where is it" into "how far, how
   soon" — which is the actual decision for a two-person team.
3. **Zoom-to-region** with a filter for in-person only — the SA cluster is
   the one that costs travel.
4. **Time-scrub** across the next 90 days, watching markers light up as
   their deadlines approach. Pairs with the `/stats` timeline.

## 7. Menus and sub-menus

Routes today: `/` (Board), `/stats`, `/radar`, `/updates`.

Sub-navigation worth adding:
- `/o/$id` — per-opportunity detail (prep ladder, evidence, quoted spans,
  the build repo if one is linked). The old static site had this; the
  rebuild dropped it.
- `/stats` sections deep-linkable (`#collisions`, `#lag`) so the assistant
  can cite a specific chart.
- `/sources` — the watchlist itself: which orgs are monitored, when each
  was last swept, what it yielded. Makes the autonomy visible instead of
  invisible.

## 8. Features worth building, ranked by "would actually change a decision"

1. **"Can we build this?"** — capability match + effort feasibility on
   every card. Answers the real question, and it's honest today.
2. **Prep ladder generated backwards from the deadline**, sized to observed
   velocity, with a buffer the planner refuses to fill. Re-plans itself
   when a date moves.
3. **Idea memory** — when a new challenge's theme matches a prior build,
   surface what we did and how it placed. Needs `retros.json`.
4. **Self-audit on discovery lag** — the board grading its own misses, per
   source. Half-wired already; needs `went_live_on` to start arriving from
   the pipeline rather than being null.
5. **Assistant with tool access** — let it query the board, not just read a
   context blob: "what should we drop this week" answered from
   collisions + capability match + expected value.

## 9. Sequence

Nothing here is blocked on a decision. Rough order by value per hour:

1. Backfill `editions` with prior-year dates → unlocks forecasting for six
   undated entries **(highest value, pure research, no new code)**
2. `data/retros.json` + capture habit → unlocks everything in Tier 1/2
3. Capability match onto the board UI
4. Globe interactivity (click-through, arcs)
5. `/sources` route — make the autonomy visible
6. Bright Data behind the yield gate
7. Observation → PR promotion step
