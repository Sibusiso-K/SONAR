# Runbook

Symptom first. Each section says how to confirm the problem, what to do, and how to check it worked.

## The live board is out of date

1. **Is the nightly job red?** Actions, **Refresh board**. If recent scheduled runs are failing, fix that first; see the next section. This was the cause of a two-month outage in autumn 2026.
2. **Is the data on `main`?** The site shows what `main` last synced. A change sitting on a branch or in an open PR is not live.
3. **Force a sync:** Actions, **Refresh board**, **Run workflow**, branch `main`. A green run means the live database was updated.
4. **Check the live-site secrets** if the run reports "sonar-radar sync SKIPPED": `RADAR_SUPABASE_URL` and `RADAR_SUPABASE_SERVICE_KEY` are missing.

## "Refresh board" is failing

Open the failed run and find the first red step.

| First red step | Cause | Fix |
|---|---|---|
| **Run oven-sh/setup-bun** (`HTTP 504`) | The unpinned "latest" Bun release failed to download. | The workflow pins Bun (`bun-version` in `refresh-board.yml` and `BUN_VERSION` in `ci.yml`). Bump the pin to a version that downloads. |
| **Validate against the schema** or **Rebuild opportunities.json** | A drifted score, a duplicate id, or a malformed entry. | Run `make data` and `make check` locally; the message names the entry. |
| **Sync the board to sonar-radar's Supabase project** | Missing secrets or a rejected write. | See the Supabase section below. |
| **Sync the board to the app schema** | Lethabo's mirror project is missing a column (`PGRST204 ... 'status'`). This step is allowed to fail (`continue-on-error`) so it no longer blocks the commit. | Apply `supabase/migrations/0005_app_opportunities_status.sql` to that project (see **Apply a migration**). |
| Sync step: `refusing to delete N of M rows` | The sync would remove more than half the live table, which looks like a truncated `opportunities.json`. This is a safety guard, not a bug. | Inspect `data/opportunities.json` and the last commit to it. Re-run once it is right. |

## Apply a migration

Never paste SQL from an untrusted place. Migrations live in the repo and are applied by a workflow.

1. Actions, **Apply Supabase migrations**, **Run workflow**.
2. `project`: `root` (discovery) or `web` (live site). `file`: a bare filename such as `0005_app_opportunities_status.sql`. Anything with a slash or `..` is rejected.
3. Tick `dry_run` first to print the SQL without applying it.
4. It runs in a single transaction with `ON_ERROR_STOP`, so a failure applies nothing.

## Check that the database is locked down

The anon key is public, so Row Level Security is the only barrier between a visitor and your data.

1. Open the live-site Supabase project, SQL editor.
2. Paste [`supabase/audit/rls_audit.sql`](../supabase/audit/rls_audit.sql) and run it. It only reads.
3. Every query should come back with the expected result stated in its comment. In particular: no table without RLS, and no write policy open to `anon` except the `watchlist` and the watch-action `updates` insert.

## Roll back a bad deploy

1. Vercel, project **sonar**, **Deployments**.
2. Find the last good Production deployment and choose **Promote to Production** (instant rollback, no rebuild).
3. Then revert the offending commit on `main`.

Data changes roll back by reverting the commit and letting **Refresh board** sync; there is nothing to roll back on Vercel.

## Run the post-deploy smoke test by hand

```bash
python3 scripts/smoke_check.py https://sonar-two-brown.vercel.app
```

Vercel Authentication answers 401 to anyone without a session. Create **Protection Bypass for Automation** in the Vercel project settings, then `export VERCEL_PROTECTION_BYPASS=<secret>` (and add it as a GitHub secret of the same name for the scheduled run).

## Rotate a key

| Key | Where it lives | Steps |
|---|---|---|
| Supabase service key | GitHub Secrets (`SUPABASE_SERVICE_KEY`, `RADAR_SUPABASE_SERVICE_KEY`) | Roll it in the Supabase dashboard (Project Settings, API), update the secret, re-run **Refresh board**. |
| Supabase anon key | Vercel (`VITE_SUPABASE_PUBLISHABLE_KEY`) | Public by design. Rotate if abused; update the Vercel variable and redeploy. |
| Groq key | Vercel and GitHub (`GROQ_API_KEY`) | Create a new key, update both, delete the old one. |

If a secret was ever committed: rotate it first, then remove it from history, then tell the other operator. `gitleaks` and GitGuardian are the tools for finding it; a scan of this repository's full history on 9 Nov 2026 found none.

## The assistant says "Too many questions" or "could not answer"

- **Too many questions:** the per-client limit is 6 a minute and the global limit 30. It resets on its own. Limits are per warm server instance, so they are a brake, not a guarantee.
- **Could not answer:** the message names which backends were tried. Groq's free tier allows about 8,000 tokens a minute and one answer uses about 6,000, so two asks in a minute can trip it. Set `GROQ_MODEL` if the model was retired.

## The source watcher found nothing, or too much

Candidates land in `data/candidates.json` as `status: new`. A person promotes one by writing a real entry in `hackathons.json` and setting it to `promoted`, or dismisses it with a reason. The sweep flags pages with hidden text or model-steering phrases in its log; read those before trusting anything from that page.
