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
  still need confirming (see below) — those are a different pair of secrets
  from the `SUPABASE_*` ones, pointed at a different project.
- **`RADAR_SUPABASE_URL` / `RADAR_SUPABASE_SERVICE_KEY`**: needed for
  `scripts/sync_radar.py` to push the real board into sonar-radar's
  Supabase project on the daily schedule. sonar-radar's own dashboard →
  Project Settings → API → service_role key. Already run once by hand
  (2026-08-11) — the fabricated Lovable seed data is gone and the live
  site shows the real 16 opportunities — but without these secrets set,
  every future scheduled run silently skips the sync and the board will
  drift stale again.

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
4. **Run #4: clean.** `[zindi] https://zindi.africa/competitions` →
   `1 candidate(s), 1 verified` → `1 candidates, 1 verified, 0 rejected`.
   A real quote, copied verbatim from the live page by Groq, passed the
   span-check, and was written to `observations` in the `SONAR` Supabase
   project.

It currently has **one real URL to watch** — `zindi.africa/competitions`,
via `sonar_db.py`'s `WATCHLIST`. The other ~50 organisations there have a
slug/name/sector but no URL on purpose: bulk-guessing career/news page URLs
and presenting them as fact would be exactly the kind of unverified claim
this project exists to catch. Add one at a time, after actually opening and
confirming it: `update organisations set events_url = '...' where slug =
'fnb';` (or `careers_url`/`news_url`, whichever fits the org).

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
