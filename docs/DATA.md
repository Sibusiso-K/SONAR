# Data architecture

Two stores, one rule.

```
Supabase   everything we have ever SEEN     append-only · machine-written · queryable across time
Repo JSON  what we have VERIFIED            reviewed in a PR · drives the site
```

**Nothing reaches the published board without passing through a diff.** Supabase never
writes to the site. The promotion step lifts verified state into
`data/opportunities.json` as a pull request, and merging that PR is what redeploys.

---

## Why a database, when the repo already holds the board

The repo is a genuinely good database for *current state*: it's free, diffable,
versioned, and access-controlled by GitHub. It stays.

What it cannot do is answer questions **across time**. The question that matters —

> *"What day of the year does this organiser usually announce?"*

— is a `GROUP BY` over several years of observations. Git stores that history but
can't query it. That single query is what turns the Discovery Gradhack miss into a
watch that fires next August, so it's worth a database.

Four things Supabase adds that JSON-in-git can't:

| | |
|---|---|
| **Forecasting** | `editions` holds one row per year per recurring opportunity. Two years is enough to predict the third. |
| **Provenance at volume** | `observations` is append-only, one row per extracted field, each pointing at the snapshot bytes it came from. Thousands of rows a month would bloat the repo. |
| **Self-optimising cost** | `source_runs` tracks candidates → commits → spend per feed. A source with cost and no commits gets switched off. The bill falls over time instead of rising. |
| **Hallucination monitoring** | `v_hallucination_rate` charts span-check failures per day. A rise means a prompt regression, and you find out before a wrong date reaches a calendar. |

---

## Schema

`supabase/migrations/0001_init.sql`. Nine tables, four views.

```
organisations   the Tier-B watchlist (~50 seeded). Watching orgs beats searching for events.
opportunities   current canonical state, mirrors data/opportunities.json
editions        one row per year per recurring opportunity  ← powers forecasting
observations    append-only field sightings with quoted_span + snapshot_sha
snapshots       raw fetched content, content-addressed by sha256
sources         the feed registry, tiered A–E by cost
source_runs     per-source yield: candidates, commits, spend
predictions     forecast output — watch windows, never facts
pipeline_runs   operational audit and spend
```

Views: `v_board` (what the site renders), `v_source_yield` (which feeds earn their
keep), `v_watch_now` (windows opening in the next 30 days), `v_hallucination_rate`.

### Row-level security

RLS is on for every table. Public read is granted only on the published surface —
organisations, opportunities, editions, predictions, sources. **Snapshots,
observations and run logs have no select policy**, so the anon key cannot reach
them: they hold scraped page content and cost data with no reason to be public.

The pipeline uses the service-role key, which bypasses RLS. That key lives in
GitHub Secrets and must never reach a browser. The website never talks to
Supabase at runtime at all — see below.

---

## Flow

```
  sweep ──▶ observations ──▶ [span check] ──▶ opportunities ──┐
                                  │                            │
                              failed spans                     │
                                  ▼                            ▼
                       v_hallucination_rate          promotion PR ──▶ data/*.json
                                                                          │
  editions ──▶ forecast ──▶ predictions ──▶ data/predictions.json ────────┤
                                                                          ▼
                                                              next build ──▶ static site
```

The site is a **static export**. It reads JSON files at build time and ships HTML.
No Supabase client, no API keys in the browser, no runtime cost, nothing to leak.
Supabase is a build-time and pipeline-time concern only.

---

## Setup

```bash
# 1. Create a project at supabase.com (free tier is ample)
# 2. Apply the schema — SQL editor, or:
supabase db push

# 3. Credentials (Project Settings → API)
export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_KEY=eyJ...

# 4. Load the watchlist and push current state
python3 scripts/sonar_db.py seed-orgs
python3 scripts/sonar_db.py push
```

Store `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` as GitHub repository secrets and
the daily workflow picks them up. Without them it logs a notice and skips — the
board keeps working, you just lose forecasting.

### Commands

```
seed-orgs   load the ~50-organisation Tier-B watchlist
push        repo JSON  → Supabase
forecast    editions   → predictions (writes data/predictions.json)
pull        active watch windows → data/predictions.json
yield       which sources are worth paying for
health      hallucination rate + recent run status
```

Stdlib only. PostgREST is REST and JSON, so there's nothing to install and no
transitive dependency to break in CI.

---

## Forecasting

`scripts/sonar_db.py forecast`. Deliberately simple and explainable: with two or
three data points, a seasonal mean plus spread is honest. Anything fancier would
be a model pretending to know more than the data supports, which is the exact
failure SONAR exists to prevent.

For each opportunity with **≥2 editions** (one is an anecdote, not a season):

1. Convert each event date to day-of-year and take a **circular mean**. Day-of-year
   wraps: 28 December and 4 January are seven days apart, not 359. A naive average
   of those two puts the event in *July*. This is tested.
2. Spread becomes the window; floor of ±7 days.
3. Announcement window = event window minus the **observed median lead time**, or a
   stated 6-week assumption when no announcement dates are recorded. Which one was
   used is written into `basis` so you can see it.
4. Confidence rises with edition count and falls with spread, **capped at 0.8** — a
   prediction is never allowed to look confirmed.

Verified against the board's own history:

| | Prediction | Note |
|---|---|---|
| Discovery Gradhack (2024/25/26, all August) | event 2–16 Aug 2027, **watch from 7 Jun** | the miss, fixed |
| FNB App of the Year (2024/25) | event 18 Oct–1 Nov 2026 | independently matches the "expected window, VERIFY" already on the board |
| Year-wrapping event (28 Dec / 4 Jan) | 25 Dec–8 Jan | circular mean held |
| Single edition | *skipped* | not guessed at |

Predictions land on **Radar only**, as windows rather than dates. A database
trigger supersedes them automatically the moment a real source confirms.

---

## What to backfill first

Forecasting is only as good as `editions`. Highest value, in order:

1. **Discovery Gradhack** 2024, 2025 — closes the loop on the entry that started this.
2. **FNB App of the Year** — recurs annually, high local value, already on the board.
3. **Geekulcha** — multiple events a year; needs its own family slug per event.
4. **Huawei ICT** — the wrap case; already modelled.
5. **Entelect University Cup** — the board notes a 2024 edition and nothing since.

Each needs: `year`, `event_start`, and `announced_on` where findable. Announcement
dates are worth chasing — they change the watch window from a 6-week guess to an
observed median.
