# Architecture

## The one rule

> **Nothing reaches the published board without passing through a reviewed diff.**

The repository is the source of truth for what SONAR has *verified*. Databases hold what it has merely *seen*. The automated pipeline can propose; only a merged pull request publishes.

## Where the live site's data lives

Since 16 Nov 2026 the live site reads **sonar-radar**, Supabase project `dvpozmjhoxfvdafmphyr` (eu-west-2) in Sibusiso-K's Org. It was recreated there because the earlier sonar-radar sat under a login nobody could reach any more. It holds only what `scripts/sync_radar.py` pushes from the repo, so it can always be rebuilt: apply `web/supabase/migrations/` in order (schema only; the first file's seed rows are Lovable placeholders, not data), then run **Refresh board**. Watchlist stars and debriefs are the only rows that exist nowhere else.

Lethabo's SONAR project (`txmxygjqndenkcdpweym`) keeps the discovery pipeline in `public` and a non-critical mirror of the board in `app`; the site does not read it.

## Components

| Component | Where | Runs | Writes to |
|---|---|---|---|
| Source data | `data/hackathons.json`, `data/calendar_events.json` | Edited by people in PRs | (it is the source) |
| Generators | `scripts/migrate_to_opportunities.py`, `scripts/sonar.py ics` | CI and `make data` | `data/opportunities.json`, `calendar/sonar-2026.ics` |
| Live-site sync | `scripts/sync_radar.py` | GitHub Actions, nightly and on merge to `main` | the **live-site Supabase project** (`opportunities`, `past_opportunities`, `updates`) |
| Source watcher | `scripts/watch_sources.py` | GitHub Actions, every 6 hours | the **discovery Supabase project** (`observations`, `snapshots`), then `data/candidates.json` |
| Monday sweep | `scripts/monday_sweep.py` | GitHub Actions, Mondays 05:23 SAST | `data/discoveries.json` (findings for review, never the board) |
| Forecaster | `scripts/sonar_db.py forecast` | Nightly | `data/predictions.json` |
| Web app | `web/` | Vercel (server-rendered, Nitro) | nothing on the board; the watchlist, watch-action audit rows and debriefs only |
| Assistant | `web/src/lib/assistant.*` | Vercel server function | nothing; read-only over the board. Free OpenRouter models first, the built-in engine last ([MODELS.md](MODELS.md)) |
| Debriefs | `web/src/lib/debrief*.ts`, `components/DebriefPrompt.tsx` | Browser plus one server function | the live-site `debriefs` table (or the browser, until it exists) |

## Two Supabase projects, on purpose

| | Discovery project | Live-site project |
|---|---|---|
| Purpose | Everything SONAR has *seen*: append-only observations, snapshots, run costs, forecasts | What the *website* shows: the verified board |
| Written by | `watch_sources.py`, `sonar_db.py` (service key, in GitHub Secrets) | `sync_radar.py` (service key, in GitHub Secrets) |
| Read by | The pipeline only. Anon key cannot read observations or snapshots. | Visitors, through the public anon key |
| Migrations | `supabase/migrations/` | `web/supabase/migrations/` |

The website never talks to the discovery project. See [DATA.md](DATA.md) for why the split exists.

## Data flow on a merge to `main`

1. A PR changes `data/hackathons.json`. CI checks the entry against the schema and that the generated files are current.
2. Merge. `Refresh board` runs: it rebuilds `opportunities.json`, validates it, syncs both Supabase projects, commits any regenerated data, and verifies the web app still builds.
3. The site reads the live-site project **at request time from the browser**. The deployed bundle contains no board data, so a data change shows up without a redeploy. A code change deploys through Vercel's Git integration.

## Trust boundaries

| Boundary | Control |
|---|---|
| Public internet to the site | Vercel sign-in on `*.vercel.app` URLs; security headers on every response ([`security-headers.ts`](../web/src/lib/security-headers.ts)); CSRF middleware on server functions |
| Browser to database | The anon key is compiled into the bundle and **is public**. Row Level Security must make it read-only on the board tables. Audit with [`supabase/audit/rls_audit.sql`](../supabase/audit/rls_audit.sql). |
| Browser to assistant | Unauthenticated, so: per-client and global rate limits, size-capped conversations, upstream error detail kept in server logs |
| Language model to stored data | A model's output is never stored as it comes back. Debrief fields are checked against the person's own text, sweep findings against the source page; anything not found there is dropped ([`debrief.ts`](../web/src/lib/debrief.ts), [`monday_sweep.py`](../scripts/monday_sweep.py)) |
| Browser to debriefs | No login, so the anon key may insert (never update or delete) rows whose `filed_by` is one of the two crew names and whose sizes are bounded; the database, not the browser, sets the time. Debriefs are never put into the assistant's prompt |
| Scraped pages to the language model | Hidden text is stripped before extraction, steering phrases are flagged, and every extracted fact must be backed by an exact quote from the page ([`watch_sources.py`](../scripts/watch_sources.py)) |
| CI to databases | Service keys live only in GitHub Secrets. Workflow inputs are passed through the environment and validated, never interpolated into shell. |
| Data to links in the UI | Hrefs from data are restricted to `http(s)` ([`safe-url.ts`](../web/src/lib/safe-url.ts)) |

## Dates and time zones

The board is a South African calendar. Every "today" is computed in `Africa/Johannesburg`: `today_sast()` in Python and `boardDateKey()` in the web app. South Africa has no daylight saving, so the offset is a fixed UTC+2 and needs no timezone database. Numbers and dates are formatted with `en-GB` locale data, which is identical in Node and browsers; `en-ZA` differs between them and caused hydration errors.

## Environments and configuration

| Variable | Where | Secret? | Used for |
|---|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Vercel | Public by design (compiled into the bundle) | The browser's database client |
| `OPENROUTER_API_KEY` | Vercel and GitHub | **Yes** | Assistant answers, debrief structuring, Monday sweep (all work without it, on built-in fallbacks) |
| `OPENROUTER_MODELS` | Vercel, GitHub variable (optional) | No | Replace the measured model order |
| `GROQ_API_KEY` | Vercel and GitHub | **Yes** | Second assistant vendor (optional); the 6-hourly source extraction |
| `GROQ_MODEL`, `ASSISTANT_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Vercel (optional) | No | Choose the assistant's model and backend |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | GitHub Secrets | **Yes** | Discovery project writes |
| `RADAR_SUPABASE_URL`, `RADAR_SUPABASE_SERVICE_KEY` | GitHub Secrets | **Yes** | Live-site project writes |
| `SUPABASE_DB_URL`, `RADAR_SUPABASE_DB_URL` | GitHub Secrets | **Yes** | Applying migrations |
| `VERCEL_DEPLOY_HOOK` | GitHub Secrets | **Yes** | Optional rebuild trigger |
| `VERCEL_PROTECTION_BYPASS` | GitHub Secrets | **Yes** | Lets the smoke test reach a protected deployment |

## Why these choices

- **Static, generated files in git** make every change reviewable and the board reproducible. The cost is a regeneration step, which CI enforces.
- **Standard-library Python** keeps the pipeline runnable anywhere with no install step.
- **Browser-side data loading** keeps data out of the bundle, so the nightly sync updates the site without a deploy.
- **A fixed UTC+2 offset** removes a dependency and a class of timezone-database bugs.
