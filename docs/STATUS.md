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

- **Supabase**: `supabase/migrations/0001_init.sql` has never been applied
  to a real project from inside a session — the Supabase MCP connection
  has dropped every time it's been tried. Someone needs to either run
  `supabase db push` locally against the connected project, or reconnect
  the MCP and apply it directly. Until this happens, `scripts/sonar_db.py`
  has nothing to talk to and the whole "Supabase = everything ever seen"
  half of the architecture is inert.
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
  urgent either way.
- **`RADAR_SUPABASE_URL` / `RADAR_SUPABASE_SERVICE_KEY`**: needed for
  `scripts/sync_radar.py` to push the real board into sonar-radar's
  Supabase project on the daily schedule. sonar-radar's own dashboard →
  Project Settings → API → service_role key. Already run once by hand
  (2026-08-11) — the fabricated Lovable seed data is gone and the live
  site shows the real 16 opportunities — but without these secrets set,
  every future scheduled run silently skips the sync and the board will
  drift stale again.

## Pending — the actual autonomy (the original ask)

Worth being blunt about this: **nothing scrapes anything yet.** The pipeline
architecture, source tiers, confidence state machine and JSON schema in
`docs/AUTONOMY.md` are a complete design, and the data on the board today
was entered by hand (by Sbu, verified against real source links). None of
the following exist as running code yet:
- Bright Data / SERP fan-out jobs for tier-C discovery
- The organisation-watchlist crawler for tier-B (the highest-leverage piece
  — watching ~50 orgs' careers/news pages beats keyword search)
- LinkedIn/Instagram/Facebook/TikTok scraping (tier-D, last resort)
- The AIML/Claude extraction step that turns a snapshot into a candidate
  `evidence[]` entry with a `quoted_span`
- Google Calendar sync (`docs/CALENDAR.md` documents the design; no
  calendar has actually been written to)
- Notifications (no Slack/email/push wiring exists)

This is the biggest gap between "what we designed" and "what runs." It's
also the part that actually delivers on "we don't have to check manually" —
until it exists, the board is only as fresh as the last manual edit.

## Pending — small UI polish (not blocking)

- `/stats` route (see decision above — build it plain-JSON if we're staying
  static)
- Org-initials badge (`OrgIcon`) has no collision-avoidance across the 6
  hash colours for orgs with only 1–2 letters of overlap; harmless
  cosmetically, not worth fixing unless it actually collides visibly.
- The PWA icon is a plain radar-ring mark — fine, but nobody has actually
  installed the PWA on a phone and checked home-screen icon cropping.

## What's genuinely solid and doesn't need revisiting

Design-token theming (light/dark), the anti-hallucination
evidence/quoted-span mechanic, the circular-mean forecasting math (tested
against the Dec/Jan year-wrap case), the `/about` page, and the data model
migration from `hackathons.json` → `opportunities.json`. Don't re-litigate
these without a concrete reason.
