# SONAR — status and what's left

Last updated 2026-08-11. This is the one place to check "what's actually
done vs. what's still just a plan." Everything below is written from the
repo as it exists right now, not from memory.

## What's live today

A static Next.js site (`web/`), rebuilt from `data/*.json`, hosted free on
Vercel. Four pages: Board, Radar, Updates, About. No server, no database in
the loop for the site itself — the repo is the database. Design system,
data model, verification-confidence machine and forecasting math are all
documented in `docs/AUTONOMY.md` and `docs/DATA.md`.

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

## Decision needed before more UI work: which app are we building?

`docs/LOVABLE_PROMPT.md` (Sbu, today) specs a *second, different*
application — a Supabase-backed dynamic dashboard rebuilt in Lovable, with
login-free shared watchlists, a `/stats` analytics view (win-probability,
expected value, collision forecasting), and an in-app AI assistant over a
free Hugging Face model. That is a legitimate, well-thought-out direction,
but it is **architecturally a different app** from the static-export site
above — dynamic Postgres reads instead of a build-time JSON snapshot,
a live edge function instead of nothing running server-side.

Both can't be "the" site. Before either of us puts more hours into UI:
- **If Lovable is the future**: the static site's job shrinks to being the
  read-only public mirror / cheap fallback, and the real work moves to the
  Supabase schema (already drafted in `supabase/migrations/0001_init.sql`,
  not yet applied — see below) plus whatever Lovable generates.
  `watchlist` becomes a real shared table instead of per-browser
  `localStorage`, which also directly fixes the "watching only works on
  one person's laptop" limitation called out in the prompt.
- **If the static site stays primary**: the `/stats` ideas (win-probability
  ranking, expected-value sort, deadline-collision warnings,
  discovery-lag tracking) are all still worth having — they can be built as
  a plain `/stats` route reading the same `data/*.json`, no Supabase or
  Lovable required, just more derived fields in `lib/data.ts`.

Recommendation: don't fork effort into both. Pick one this week — everything
in the pending list below assumes we keep going on the current static site
until that call is made, since it's the one that's actually live.

## Pending — integrations that exist on paper but aren't verified live

- **Supabase**: `supabase/migrations/0001_init.sql` has never been applied
  to a real project from inside a session — the Supabase MCP connection
  has dropped every time it's been tried. Someone needs to either run
  `supabase db push` locally against the connected project, or reconnect
  the MCP and apply it directly. Until this happens, `scripts/sonar_db.py`
  has nothing to talk to and the whole "Supabase = everything ever seen"
  half of the architecture is inert.
- **Vercel**: connected earlier in the build but never confirmed with an
  actual `get_project` / `list_deployments` check from a session — we've
  been going on the README's manual deploy instructions (Root Directory =
  `web`), not a verified live URL. Confirm the project exists and is
  wired to this repo, and get the real `*.vercel.app` URL into this doc.
- **Mobbin MCP**: requested for UI mockup reference, was never actually
  connected long enough to call. Still unused. Given the board's current
  design already reads as clean/professional (see screenshots taken this
  pass), this is now optional polish research rather than a blocker.
- **GitHub Actions secrets**: `.github/workflows/refresh-board.yml` expects
  `VERCEL_DEPLOY_HOOK` and (optionally) Supabase creds as repo secrets.
  Unconfirmed whether these are set — if not, the daily scheduled job
  will run the data-regeneration half fine but silently no-op the deploy
  trigger.

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
