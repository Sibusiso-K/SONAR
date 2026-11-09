# Testing

Run the fast checks before every push. Run the browser tests when you touch the site.

| Command | What it runs | Time |
|---|---|---|
| `make check` | Python lint, web type-check, web lint, Python tests, web unit tests | ~20 s |
| `make test` | Python tests only (`pytest`), including data-integrity checks | ~6 s |
| `make test-web` | Web unit tests (`vitest`) | ~1 s |
| `make e2e` | Browser tests (Playwright), desktop and mobile viewports | ~2 min |
| `make audit` | `bun audit` and `bandit` | ~10 s |
| `make smoke URL=...` | Smoke test of a running site | ~5 s |

CI runs all of these on every pull request. `CI result` is the single check to require on `main`.

## What each layer is for

**Python unit tests (`tests/`)** cover the pipeline's logic: date and score handling, ICS generation, the migration, row building for the live database, the guarded delete, the forecaster, and the scraper's defences against hidden text and prompt injection. They mock the network and use no credentials.

**Python CLI tests (`tests/test_cli.py`)** run the scripts as subprocesses with real exit codes, because import errors and tracebacks only show up that way.

**Data-integrity tests (`tests/test_data_integrity.py`)** guard the files that drive the live site:

- Unique ids and main links; no tracking parameters; https links.
- Scores match their weighted sub-scores and tiers match scores.
- Every entry validates against `schema/hackathon.schema.json`, with one exception: older entries listed in `LEGACY_SCHEMA_DEBT` have a known prize-shape problem. **Do not add to that list.** Fix the entry instead. The test also fails when a listed entry becomes valid, so the list can only shrink.
- `data/opportunities.json` and `calendar/sonar-2026.ics` match what the generators produce now. If this fails, run `make data` and commit the result.
- The rows the pipeline pushes have exactly the columns the web app's generated database types declare.

**Web unit tests (`web/src/**/*.test.ts`)** cover the pure modules: date arithmetic in the board's time zone, win probability, number formatting, URL safety, the rate limiter, conversation trimming, security headers, and the splash and transition logic.

**Browser tests (`web/e2e/`)** run the production build (`NITRO_PRESET=node-server`) in Chromium against a mocked database. The fixture is built by the real `sync_radar.build_rows()`, so they exercise the actual data contract. They cover first-load and repeat-visit behaviour, every section on desktop and a phone viewport, error states, hostile data, the rate limit, security headers, and horizontal overflow.

## Writing tests here

- **Test the failure, not just the success.** A smoke test that cannot fail is decoration; `tests/test_smoke_check.py` shows the pattern: a fake server that breaks in each way the check is meant to catch.
- **A bug fix ships with a test that fails without it.** Several tests here are named after the bug they pin (see `TestLeadTimePairing`, the `fieldSize` regression, the horizontal-overflow spec).
- **Keep browser tests hermetic.** `e2e/support.ts` stubs every non-local request, so tests do not depend on Google Fonts, map tiles or logo hosts.
- **Do not weaken an assertion to make a test pass.** If a rule is wrong, change the rule in the same pull request and say why.

## Running the browser tests somewhere without a downloadable browser

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome bun run test:e2e
```

## Coverage

`pytest --cov=scripts` reports coverage. The pure logic is well covered; the commands that talk to live services (Groq, the GitHub API, the Supabase writes beyond the REST helper) are not, and rely on the guards above plus manual runs. See [QA_REPORT_2026-11-09.md](QA_REPORT_2026-11-09.md) for the numbers and the gaps.
