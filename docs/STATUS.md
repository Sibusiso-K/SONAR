# SONAR — status and what's left

Last updated 2026-08-11. This is the one place to check "what's actually
done vs. what's still just a plan." Everything below is written from the
repo as it exists right now, not from memory.

## What's live today

`web/` is now the sonar-radar app (TanStack Start + Supabase), not the old
static Next.js export — replaced 2026-08-11. It's the more complete Lovable
rebuild `docs/LOVABLE_PROMPT.md` specced: four routes (Board, Radar, Stats,
Updates), a shared no-login watchlist, and an AI assistant, backed by its
own live Supabase project. Design system, data model, verification-confidence
machine and forecasting math for the *board content* are still documented in
`docs/AUTONOMY.md` and `docs/DATA.md` — those apply to what data means, not
which frontend renders it.

`scripts/sync_radar.py push` makes that Supabase project's `opportunities`
and `past_opportunities` tables match `data/opportunities.json` exactly,
deleting anything not in the JSON. It's wired into
`.github/workflows/refresh-board.yml`, gated on the `RADAR_SUPABASE_URL` /
`RADAR_SUPABASE_SERVICE_KEY` repo secrets (see Pending below) — until those
are set, the workflow no-ops that step and the live site keeps whatever it
last had.

**Fixed this pass:**
- The pre-existing React hydration error (#418) on `/` and `/radar` is
  fixed. Root cause was `formatPrize()` calling `pool.toLocaleString("en-ZA")`
  — Node's ICU and this environment's Chromium disagree on how "en-ZA"
  groups thousands (`"1 234"` vs `"1,234"`), so the server-rendered HTML and
  the client's first render literally had different text. Replaced with a
  plain-string thousands-grouper that can't disagree with itself. Also
  hardened `useWatchlist()`'s initial state (was reading `localStorage`
  synchronously at module load, which mismatches the server's always-empty
  render for a returning visitor) — not the actual trigger, but a real latent
  mismatch worth closing anyway. Verified with a headless-browser hydration
  check across all four routes, with and without a seeded watchlist.
- Rebased the feature branch onto Sbu's latest `main` (org-initials badges,
  in-person/online/hybrid chips, 2-column mobile stat tiles, PWA
  manifest/icons) — kept all of it, it's good work and matches the
  "professional, not generic" bar. No conflicts, build verified clean.

## Decision made: sonar-radar is the app

The "which app are we building" fork is resolved — sonar-radar (the Lovable
rebuild from `docs/LOVABLE_PROMPT.md`) replaced the static Next.js site in
`web/` on 2026-08-11. It already has `/stats`, the shared watchlist, and the
AI assistant that were the whole reason to consider it. The static-export
code is gone from this repo (still recoverable from git history before that
commit if needed).

What this did *not* automatically fix: sonar-radar has its own Supabase
project, separate from `supabase/migrations/0001_init.sql` (still unapplied,
still the "everything ever seen" discovery-pipeline schema — a different,
larger initiative, not this one). `scripts/sync_radar.py` now bridges
`data/opportunities.json` into sonar-radar's tables — see above.

## Pending — integrations that exist on paper but aren't verified live

- **Supabase — two separate projects, don't confuse them:**
  - **`SONAR`** (`txmxygjqndenkcdpweym`, eu-west-2, $0/month, under Lethabo's
    account) — the discovery-pipeline backend from `docs/DATA.md`:
    organisations/observations/snapshots/editions/predictions/sources. Both
    `0001_init.sql` and a `0002_security_hardening.sql` follow-up (4
    SECURITY DEFINER views were silently bypassing RLS on tables that are
    deliberately private — `get_advisors` caught it, fixed same session) are
    applied. `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` repo secrets point here.
    Nothing here reaches the board directly — it's raw evidence, not
    verified fact.
  - **sonar-radar's project** (Sbu's account) — what the *live website*
    reads from. Unrelated to the one above beyond sharing a similar name.
    Fed by `scripts/sync_radar.py push` from `data/opportunities.json`, per
    `RADAR_SUPABASE_URL`/`RADAR_SUPABASE_SERVICE_KEY` below.
- **Vercel**: confirmed live — project `sonar` (`sonar-two-brown.vercel.app`).
  It was connected to `Sibusiso-K/sonar-radar`, a repo Lethabo doesn't have
  access to; every early deploy attempt from `Sibusiso-K/SONAR` itself had
  actually failed (`Couldn't find any pages or app directory` — Root
  Directory wasn't set). Repointed 2026-08-11 to `Sibusiso-K/SONAR` with
  Root Directory = `web`, so both contributors' commits now reach the same
  deployment. `sonar-radar` is no longer the deploy source; treat it as
  retired unless someone decides otherwise.
- **Mobbin MCP**: requested for UI mockup reference, was never actually
  connected long enough to call. Still unused. Given the board's current
  design already reads as clean/professional (see screenshots taken this
  pass), this is now optional polish research rather than a blocker.
- **GitHub Actions secrets**: `.github/workflows/refresh-board.yml`'s
  `VERCEL_DEPLOY_HOOK` step is now redundant for `web/` — Vercel's Git
  integration deploys directly on push to `SONAR`'s `main`, no hook needed.
  Leave the step (harmless no-op without the secret) or remove it; not
  urgent either way. `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GROQ_API_KEY`
  and `AISA_API_KEY` are set. `RADAR_SUPABASE_URL`/`RADAR_SUPABASE_SERVICE_KEY`
  are also set and confirmed working (see below) — those are a different pair
  of secrets from the `SUPABASE_*` ones, pointed at a different project.
- **`refresh-board.yml` had been silently broken since the sonar-radar
  rebuild.** `actions/setup-node`'s npm cache pointed at
  `web/package-lock.json`, deleted when `web/` switched to bun. That failed
  the step outright on every run, skipping everything after it — including
  the sonar-radar sync — with the workflow otherwise looking "fine" (the
  `deploy` job runs `if: always()`, so it still pinged Vercel with stale
  data every time, quietly). Confirmed by actually triggering it this pass,
  not by inspection. Fixed: swapped in `oven-sh/setup-bun@v2`, updated the
  build-verification step to `bun install`/`bun run`, and added a
  rebase-and-retry to the data-commit step after hitting a real push race
  against a direct push to `main` during testing.
- **`RADAR_SUPABASE_URL` / `RADAR_SUPABASE_SERVICE_KEY`**: set, and now
  confirmed actually working end to end via the scheduled workflow itself
  (not just a one-off manual run) — the `refresh-board.yml` fix above was
  required to get there, since the step had never successfully run in CI
  before this pass despite secrets being set correctly.

## Pending — the actual autonomy (the original ask)

**One piece now actually runs.** `scripts/watch_sources.py` +
`.github/workflows/watch-sources.yml` (every 6 hours + manual dispatch) is a
real Tier-B watchlist sweep into the `SONAR` Supabase project above: fetch an
organisation's page, ask Groq to point at concrete opportunity mentions,
reject anything it can't back with an exact quote copied from the page.
Verified offline with mocked network calls (HTML/script/style stripping, and
the span-verification gate correctly rejecting a fabricated quote while
accepting a real one) — not yet with a live run, since no environment this
was built in has had outbound access to Groq, Supabase's REST endpoint, or
any target site directly. First real test: trigger `watch-sources.yml` via
`workflow_dispatch` and read the run log.

**Live-tested end to end now, working.** Three bugs surfaced and got fixed
across `workflow_dispatch` runs #1-#4, each one a real thing this session's
network policy made impossible to catch before pushing:
1. Run #1: sweep found no organisations — `cmd_seed_orgs` was never wired
   into a scheduled step. Fixed by adding it to `watch-sources.yml`.
2. Run #2: seed insert failed `42501: new row violates row-level security
   policy` — the `SUPABASE_SERVICE_KEY` secret held the anon key, not
   service_role (which bypasses RLS). Fixed by the secret's owner correcting
   the value.
3. Run #3: seeding worked, but the Groq call failed `403: error code 1010` —
   Cloudflare's bot-fingerprint block in front of `api.groq.com`, triggered
   by `call_groq()` sending no `User-Agent` (Python's default,
   `Python-urllib/3.x`, is a known signature Cloudflare's WAF rejects
   outright). Fixed by adding a real one.
4. Run #4: clean. `[zindi] https://zindi.africa/competitions` →
   `1 candidate(s), 1 verified`. A real quote, copied verbatim from the live
   page by Groq, passed the span-check, and was written to `observations`.

**Watching three organisations now**, all via URLs reused from
human-verified `links` already in `data/opportunities.json` rather than
freshly guessed (this session's network policy blocks WebFetch too -
confirmed `EGRESS_BLOCKED` trying to browser-check a candidate - so reusing
already-checked links beat guessing new ones). Run #5 result:
- `zindi.world/competitions` (corrected from `.africa`, matching the board's
  actual verified link) — 1 candidate, 1 verified
- `www.geekulcha.dev/events` — 5 candidates, 5 verified
- `appoftheyear.co.za/hackathon/` — **404 Not Found.** Even a link a human
  verified when the board entry was written can go stale — this looks like
  a per-edition FNB page that got taken down after the event, not a durable
  "watch this org" URL. Left as-is rather than guessing a replacement;
  `partner: https://www.22onsloane.co/fnb-aoty-hackathon/` in the same JSON
  entry is untried and might fare the same way for the same reason.

**Run #6, after adding RevenueCat's Shipaton (`shipaton.com`, its own
dedicated event site — chosen deliberately after FNB's sub-page 404'd):**
`20 candidates, 19 verified, 1 rejected across 4 organisations` — zindi 1/1,
fnb 0/0 (page loaded fine this time, just nothing extractable — a org
homepage without a live campaign is a legitimately valid "nothing to see"
result, not a bug), geekulcha 0/0 (down from 5/5 last run — see note below),
shipaton 18/19 verified **plus the gate correctly rejecting a real
hallucination**: the model claimed `"the world's biggest mobile hackathon"`
was a verbatim quote; it wasn't actually on the page, so it was thrown away
rather than promoted. Exactly the mechanism working as designed.

Worth being honest about: geekulcha going from 5 candidates to 0 between two
runs of the same page, minutes apart, is very likely LLM non-determinism —
`temperature: 0` reduces but doesn't eliminate run-to-run variance, and nothing
here retries a zero-result page to double-check. Not a bug to fix so much as
a known characteristic to design around later (e.g. only trust a "nothing
found" result after N consecutive empty sweeps, not one).

Total across all runs so far: **26 candidates, 25 verified, 1 correctly
rejected**, into `observations` in the `SONAR` Supabase project. The other
~48 organisations in `WATCHLIST` still have no URL, on purpose. Add one at a
time: `update organisations set events_url = '...' where slug = 'x';` (or
`careers_url`/`news_url`), preferring a link already
verified in `data/opportunities.json` over a fresh guess wherever one exists.

It also only writes to `observations` — raw, unreviewed evidence. Nothing
lifts a verified observation back into `data/opportunities.json`
automatically yet; a human still has to notice it and write the JSON entry.
That promotion step is the next piece worth building.

Still not built:
- Bright Data / SERP fan-out for tier-C discovery
- LinkedIn/Instagram/Facebook/TikTok scraping (tier-D, last resort)
- AIsa.one wiring (X/Twitter/Perplexity lookups, its vision model for
  image-only sources) — designed for, not yet called from any script
- The observations → `data/opportunities.json` promotion step (above)
- Google Calendar sync (`docs/CALENDAR.md` documents the design; no
  calendar has actually been written to)
- Notifications (no Slack/email/push wiring exists)

## `/stats` — the prediction/forecasting page, what's real vs decorative

`web/src/routes/stats.tsx` + `web/src/lib/analytics.ts` already implement
everything `docs/LOVABLE_PROMPT.md`'s Statistics section asked for: win
probability, expected value, deadline-collision detection, a 90-day
timeline, a winnability/prize scatter, discovery-lag-by-source, and a
confidence-mix/promotion-window chart. This was already built (Lovable),
not something to build again — but two of the six are silently empty in
production:

- **Working now**, computed purely from real fields already on each
  opportunity (`scores`, `score`, `tier`, `confidence`, `notes`, `prize`):
  win probability, expected value, deadline collisions, the timeline, the
  scatter. `sync_radar.py` pushes all of these fields for real, so these
  charts are trustworthy today.
- **`discoveryLag()` is now real, wired and confirmed live.** `source`,
  `went_live_on`, `noticed_on` are real per-entry fields on
  `data/hackathons.json` now (added deliberately, not fabricated -
  `noticed_on` is backfilled from git history: every current entry's id
  already existed in the repo's very first commit, so all 16 genuinely share
  one `noticed_on` of 2026-08-10; `went_live_on` stays honestly `null`
  everywhere, since no entry has recorded announcement-date evidence yet).
  `sync_radar.py` now reads and pushes all three instead of hardcoding
  `source`. Confirmed pushed for real via `refresh-board.yml`'s "Sync the
  board to sonar-radar's Supabase project" step, which had actually been
  silently failing on every run since the sonar-radar rebuild (see the CI
  fix below) until this pass. The chart will show one real cluster (16
  items, one source, one date) rather than fabricated variety - it starts
  differentiating for real once opportunities get discovered incrementally
  by `watch_sources.py` instead of in one research sprint.
- **`confidenceTrend()`'s promotion window now has real input** —
  `sync_radar.py` mirrors `data/updates.json` into the `updates` table and
  maps our `verified` kind to `change_kind: "confidence"`. One qualifying
  row exists today (the ADTC prize-conflict resolution), so the chart has a
  genuine data point rather than none; it gets more useful as verification
  events accumulate.

## The Updates page was serving fabricated history (fixed)

Worth recording in full, because it is the exact failure this project
exists to prevent, and it was live on the site for weeks.

When Lovable generated the app it seeded ten rows into the `updates` table.
`sync_radar.py` deliberately skipped that table, and its docstring asserted
the leftovers were *"harmless — they just don't join to anything and stop
rendering."* **That was wrong.** A screenshot of the live Updates page
showed them rendering perfectly: the page reads `summary`/`detail` and
never needs `opportunity_id` to resolve. So the audit trail — the page
whose entire job is proving the board carries nothing unverified — was
itself publishing invented history:

- *"Takealot Engineering Hack has been unconfirmed for 92 days"*,
  *"Sasol Solve prize pool marked conflicted (R50k vs R120k)"*,
  *"ARC Prize winnability lowered to 12"* — **none of these have ever been
  on this board.** Entirely invented events, with invented specifics.
- *"BCG Platinion … deadline 2026-10-14 read directly from the official
  brief PDF"* — the real deadline is **2026-09-07**, and no such PDF was
  ever read. A fabricated date carrying a fabricated provenance claim.
- *"Entelect … Team of 4 registered"* — it is a team of **2**.

All attributed to "verification pipeline", indistinguishable from real
entries. Meanwhile the genuine trail in `data/updates.json` (Gradhack
Top-6 correction, Mintek application, Entelect registration, REEFPRINT
abstract) was never synced to the site at all.

Fixed in `sync_radar.py`: the seed rows are deleted (matched on their
`opportunity_id` slugs, every one of which differs from our real ids, so
the delete cannot touch real data or anything a person appends through the
app), and `data/updates.json` is mirrored in with uuid5 ids so re-runs
update rather than duplicate. Confirmed applied via a green
`refresh-board.yml` run on 2026-08-12.

**The lesson worth keeping:** a generated app's placeholder data is not
inert. It renders, it looks authoritative, and it outlives the thing that
created it. Anything Lovable seeds should be assumed live until explicitly
purged — check `watchlist` too if it ever starts driving anything visible.
- **A separate, unconnected prediction system**: `scripts/sonar_db.py`'s
  circular-mean date forecasting (predicts *when* a recurring event's next
  edition will likely open, from multi-year history — different from
  win-probability, which scores *current* live entries) writes to the
  `SONAR` Supabase project's `predictions` table and `data/predictions.json`.
  Nothing in sonar-radar reads either. `radar.tsx`'s "predicted" bucket is
  driven by a static `confidence` field a human sets in the JSON, not by
  this forecast at all.

Fixing the two decorative charts needs a real decision, not just code: where
does "when did this go live" and "when did we first notice it" actually come
from for opportunities that already exist? The `SONAR` project's
`opportunities.first_seen_at` / `observations.observed_at` are designed for
exactly this, but connecting them means `sync_radar.py` reading from a
second project it doesn't talk to today, and accepting that anything
entered before this pipeline existed has no real history to backfill.

## Pending — small UI polish (not blocking)

The old Next.js-specific items here (org-initials badge, PWA icon) no longer
apply — that app is gone, replaced by sonar-radar. Nobody has yet installed
sonar-radar as a PWA on a phone and checked icon cropping, if it offers one;
otherwise nothing outstanding on this front right now.

## What's genuinely solid and doesn't need revisiting

The anti-hallucination evidence/quoted-span mechanic (now with a second,
working implementation in `scripts/watch_sources.py`, not just the schema),
the circular-mean forecasting math in `scripts/sonar_db.py` (tested against
the Dec/Jan year-wrap case), and the data model migration from
`hackathons.json` → `opportunities.json`. Don't re-litigate these without a
concrete reason. (The `/about` page and the old Next.js design-token system
were removed along with the static site — no longer applicable.)
