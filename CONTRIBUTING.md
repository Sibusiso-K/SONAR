# Contributing to SONAR

`data/hackathons.json` is the single source of truth. Everything else is generated from it or references it. This guide covers both ways to contribute: **changing the board** (most of the time) and **changing code**.

New here? Read the [README](README.md) first, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Setup

```bash
make install     # Python dev tools + web dependencies (Python 3.10+, Bun 1.4+)
make check       # lint, types, unit and data tests; should pass on a clean checkout
```

## The workflow

1. Branch from `main`. Short, descriptive names: `board/add-sigma-pitch`, `fix/countdown-timezone`.
2. Make the change. Run `make check` (and `make e2e` if you touched the site).
3. If you changed `data/hackathons.json` or `data/calendar_events.json`, run **`make data`** and commit the regenerated files. CI fails if they are stale.
4. Open a pull request using the template. Title it `board: add <name>` for data, otherwise a plain sentence in the imperative: `Fix countdown off-by-one near midnight`.
5. CI must be green. Squash or merge; do not force-push to `main`. Do not rewrite history that has been pushed: the repo is connected to Lovable (see `web/AGENTS.md`).

Commit messages: one imperative summary line, then a paragraph on *why* if it is not obvious. Say what you chose not to do.

## Changing the board

### Adding an opportunity

1. **Find it on the organiser's own page.** A date without a source is a rumour.
2. **Score it.**
   ```bash
   python3 scripts/sonar.py score --career 8 --win 6 --prize 7 --urgency 9
   ```

   | Factor | 0–10 means |
   |---|---|
   | `career_leverage` | 10 = recruiters in the room. 5 = a good CV line. 1 = nobody who hires will see it. |
   | `winnability` | 10 = small field, strong fit. 5 = even odds. 1 = global grandmasters. |
   | `prize` | 10 = $500k+. 7 ≈ $50k. 5 ≈ $10k. 3 = non-cash. 1 = points only. |
   | `urgency` | 10 = under 14 days. 7 ≈ 30 days. 5 ≈ 60 days. 2 = next year. |

   Tier 1 ≥ 7.0 · Tier 2 6.0–6.9 · Tier 3 < 6.0. The stored `score` must equal the weighted sub-scores and `tier` must match `score`; CI checks both. Leave an entry **unscored** (omit `score`, `scores`, `tier`) until the facts to score it exist.
3. **Add the entry** to the `hackathons` array. Copy a recent one. Set `kind` (see the schema) for anything that is not a hackathon.
4. **Set `dates.confidence` honestly.**
   - `confirmed`: you read it on the organiser's page today.
   - `reported`: a news article, an aggregator, or search results. Say so in `notes`.
   - `unconfirmed`: not announced; extrapolated from last year.
5. **Add the source** to `docs/SOURCES.md`. No exceptions.
6. **Fixed dates?** Add them to `data/calendar_events.json`.
7. `make data && make check`, then the pull request.

### Rules the tests enforce

- Ids are unique and `kebab-case`; ids never change once published.
- No two entries share a specific main link or a name.
- Links are `https` URLs with **no tracking parameters** (`utm_*`, `fbclid`, `_gl`, `ref_*`). Put emails and notes in `notes`, not in `links`.
- New and changed entries validate against `schema/hackathon.schema.json`. Use `prize.breakdown` as an array of `{place, amount, track}` and `prize.non_cash` as an array of `{type, description}`. (Older entries in `LEGACY_SCHEMA_DEBT` have an old shape; do not copy it, and fix one when you touch it.)
- Calendar times are `YYYY-MM-DDTHH:MM` in SAST, all-day events are `YYYY-MM-DD`, and an event never ends before it starts.

### Entry shape

```jsonc
{
  "id": "kebab-case-year",               // required, unique, never renamed
  "name": "Full official name",
  "organiser": "Who runs it",
  "scope": "local | continental | international",
  "kind": "hackathon | fellowship | grant | startup_competition | programme | ...",
  "format": "online | in-person | hybrid",
  "location": "Where",
  "status": "open | closing | monitor | verify | registered | selected | submitted | past | dropped | ...",
  "tier": 2,
  "score": 6.85,
  "scores": { "career_leverage": 9, "winnability": 4, "prize": 5, "urgency": 10 },
  "dates": {
    "submission_deadline": "2026-11-11T09:00:00-08:00",
    "submission_deadline_sast": "2026-11-11T19:00:00+02:00",   // keep zone-sensitive deadlines in both
    "confidence": "confirmed"
  },
  "prize": { "currency": "USD", "pool": 10000, "breakdown": [{ "place": "1st", "amount": 5000, "track": null }] },
  "eligibility": "Who can enter. Flag BLOCKERS in capitals.",
  "team_fit": "How it works for a team of two.",
  "what_to_build": "The actual brief.",
  "deliverables": ["repo", "video"],
  "links": { "main": "https://organiser.example/event" },
  "notes": "What we would tell each other over coffee. Be blunt about what you could not verify."
}
```

`status` is the competition's externally observable state; `lifecycle` is *our* state on it. Moving an entry to `past` once its deadline has gone is part of the weekly review.

### Changing a score

Scores are opinions. Change them in a pull request with a reason in the description, and update `score` to match `scores`. Do not change them silently.

### Weekly review (Monday, 30 minutes)

- [ ] `python3 scripts/sonar.py next` and `python3 scripts/sonar.py stale`
- [ ] Walk the `monitoring_sources` list; open JavaScript-rendered sites (Zindi) in a browser
- [ ] Move anything past into `past`, with a note for next year
- [ ] `make data`, commit, merge, then confirm **Refresh board** went green

## Changing code

- **Python** is standard-library only. Do not add runtime dependencies without discussing it. Dev tools go in `requirements-dev.txt`. Lint with `ruff check scripts tests`. Use `today_sast()` from `scripts/_common.py`, never `date.today()`, and open URLs with `safe_urlopen`, never `urllib.request.urlopen`.
- **Web** is TypeScript with strict types. `bun run typecheck`, `bun run lint` (Prettier is enforced through ESLint), `bun run test`. Format numbers and dates through `lib/format.ts` and `lib/analytics.ts` (`boardDateKey`, `daysUntil`), not `toLocaleString("en-ZA")` or `new Date()`: those behave differently on the server and in the browser.
- **Data-driven links** must go through `safeHref()`. **Anything public that costs money** needs a limit.
- **Every bug fix ships with a test that fails without it.** See [docs/TESTING.md](docs/TESTING.md).
- **Dependencies:** `bun.lock` must resolve from the public npm registry. Run `bun audit` before adding a package.
- **Migrations** go in `supabase/migrations/` (discovery project) or `web/supabase/migrations/` (live site), are applied by the **Apply Supabase migrations** workflow, and must keep the anon key read-only on the board tables.

## Security

Never commit a key, token, `.env` file or personal data. To report a vulnerability, see [SECURITY.md](SECURITY.md).
