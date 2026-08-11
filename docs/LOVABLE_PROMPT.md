# SONAR — Lovable rebuild prompt

Copy everything below into Lovable as the starting prompt.

---

Build **SONAR**, a two-person opportunity-tracking dashboard for hackathons, competitions, grad programmes and recruiting events. It replaces a static Next.js site — same data, much better UI, plus two new capabilities (analytics and an AI assistant). Use Supabase as the backend (auth for 2 named users: Sibusiso and Lethabo, Postgres for data, edge functions for the AI chat).

## Design direction

Blend three references, don't clone any of them:

- **bonjour.paris** — monochrome, oversized editorial type, generous whitespace, scroll-triggered reveals (letters/words animate in as you scroll), restrained motion, black-on-white confidence.
- **lunchbox.io** — bold headline hierarchy, punchy feature-card grids, high-contrast CTAs, that "confident SaaS" clarity — nothing feels tentative.
- **2020.milkshake.studio** — warm off-white/cream background (not stark white), Neue-Haas-Grotesk-style display type, playful narrative pacing, big standalone stat callouts, a sense of personality in the copy, not just dashboards.

Synthesis for SONAR: a warm, editorial dashboard — not another dark SaaS admin panel. Big confident type for the numbers that matter (days remaining, prize pool, win-probability), scroll-reveal on section entry, generous whitespace, a cream/paper base tone instead of pure white or dark mode as default (but keep a dark mode toggle). Urgency colour (red/amber/green countdown) stays a separate system from the brand accent, exactly like a real editorial infographic uses a spot colour.

## Existing product to preserve

Three views today, keep all of them, redesign the shell:

- **Board** — every live opportunity, sorted by closest deadline. Severity stripe (critical ≤7d / warning ≤21d / stable further out / none unconfirmed), org icon, name, kind, in-person/online/hybrid tag, tier badge, prize, confidence level, a star to watch/unwatch.
- **Radar** — unverified/predicted entries not yet calendar-safe, plus a "past & missed" archive that records outcomes honestly (including corrections — e.g. one entry was wrongly marked "missed" and later corrected to "Top 6" placement once we found out we'd actually competed).
- **Updates** — an append-only audit trail: every data change, timestamped, with who or what made it (human or the verification pipeline).

Data model per opportunity: `id, name, organiser, kind, format (in-person/online/hybrid), scope, tier (1-3), score, scores{career_leverage, winnability, prize, urgency}, dates{}, next_date, confidence (confirmed/reported/unconfirmed/predicted/conflicted), prize{currency,pool,breakdown}, career_track (direct/adjacent/none), eligibility, what_to_build, links{}, notes`. Bring this over as Supabase tables (`opportunities`, `past_opportunities`, `updates`, `watchlist`) instead of static JSON — that also fixes today's limitation where "watching" an item only persists in one person's browser; make it a shared, per-user table so Sibusiso and Lethabo each see what the other is watching.

## New: Statistics & Analytics section

Purpose, stated plainly for whoever builds this: **the point of this section is to make us win more.** Every chart should answer a decision, not just decorate a dashboard. Build a `/stats` view with:

**Predictive, from data we already have — no new data collection required:**
- **Win-probability score** per opportunity: combine `tier`, `score`, `scores.winnability`, and field size signals already in the notes (e.g. "10,000+ students expected" lowers odds) into a single 0–100 "worth it" number. Rank the live board by this, not just by deadline.
- **Expected value ranking**: `prize.pool × win-probability`, converted to one currency, so a long-shot $700k prize and a near-certain $2k prize can be compared honestly.
- **Deadline collision forecasting**: flag weeks where two committed opportunities overlap (this already happened once — BCG Platinion and IBM Z Datathon clash in mid-October) and surface it *before* it becomes a scramble.
- **Discovery-lag tracking**: the board's own history shows we almost missed Discovery Gradhack because nothing was watching it early enough, and only caught Entelect University Cup in time by luck. Track "days between opportunity going live and us noticing it" per source, and surface which monitored sources are consistently slow.
- **Confidence trend**: how many opportunities move from unconfirmed → reported → confirmed over time, and how long that takes on average — tells us how early to start pre-building against "expected window" entries.

**Visualization — make it genuinely cool, not default chart-library defaults:**
- A radial/gauge "win-probability" ring next to each opportunity's countdown, not just a number.
- A horizontal timeline (not a table) of the next 90 days with opportunities as cards positioned by date, density-shaded so collisions are visually obvious at a glance.
- A scatter plot: winnability (x) vs prize value (y), bubble size = career leverage, so the "worth our weekend" opportunities visually cluster away from the long shots.
- An animated counter/story block (inspired by the Milkshake reference) for headline stats: total prize pool tracked, opportunities discovered vs entered vs won, average discovery lag — presented as a short scroll-triggered narrative, not a boring KPI row.
- A simple outcomes log (wins, placements, application status) rendered as a "season so far" strip, since Gradhack Top 6 and the Entelect/Mintek applications are exactly the kind of thing that should be visible at a glance, not buried in the audit trail.

## New: In-app AI assistant

A chat panel (slide-out or docked), available on every page, that has full context of the current board data (pass it the opportunities table, scores, and dates as context/RAG, not just a generic assistant).

**Model**: use a free, open-source, high-reasoning model from Hugging Face — call it via a Supabase edge function so the API key never reaches the client. Recommended: **`deepseek-ai/DeepSeek-R1-Distill-Qwen-14B`** (strong reasoning, small enough to run on Hugging Face's free serverless Inference API without needing a paid dedicated endpoint). If that's unavailable or rate-limited at build time, fall back to **`Qwen/Qwen2.5-7B-Instruct`** — still open-source, strong general reasoning, more reliably available on the free tier. Whoever builds this should check current Hugging Face Inference API availability/pricing at build time, since free-tier model support changes.

**What it should actually help with** (scope it to this, don't build a generic chatbot):
- "Which opportunity should we prioritise this week?" — answered using the win-probability/expected-value data above, not vibes.
- Explaining why something is scored the way it is (walk through the `scores{}` breakdown in plain language).
- Drafting submission checklists / eligibility summaries from an opportunity's `eligibility` and `deliverables` fields.
- Flagging conflicts or risks it notices in the data (deadline clashes, an entry stuck on "unconfirmed" for too long).
- It should never invent dates or results — if it doesn't have a confirmed source in the data, it says so, matching this board's whole ethos (every date traces to a source).

## Tone

Keep the current site's voice: dry, precise, slightly self-aware about its own failures (the Gradhack near-miss is treated as a documented lesson, not hidden). Don't make the redesign generic-startup-cheerful — confident and a little wry is right.
