# Sbu — 3 things only you can do

> **UPDATE 2026-08-21 — Step 1 is not the blocker anymore. This is.**
>
> `RADAR_SUPABASE_URL` and `RADAR_SUPABASE_SERVICE_KEY` have been set since
> 12 Aug. But **every `refresh-board.yml` run triggered by a push to `main`
> since 17 Aug has failed** (`gh run list --workflow=refresh-board.yml`
> shows it plainly — scheduled runs on the `claude/...` branch keep
> succeeding, which is why this went unnoticed: a green tick elsewhere hid
> a red one on the branch that actually matters).
>
> The actual failure, read from the step's own stdout, not inferred:
>
> ```
> synced 19 opportunities
> Supabase POST updates -> 401
> {"code":"42501", ... "message":"new row violates row-level security
> policy (USING expression) for table \"updates\""}
> ```
>
> `opportunities` and `past_opportunities` write fine. `updates` doesn't.
> Checked the migration that defines `updates`' RLS
> (`web/supabase/migrations/20260811105003_*.sql`): it grants `anon` and
> `authenticated` **SELECT + INSERT only** — there is no UPDATE policy for
> anyone via RLS. `service_role` gets `GRANT ALL`, which normally bypasses
> RLS checking entirely regardless of policies. The upsert
> (`sync_radar.py`'s `on_conflict="id"`) resolves to an UPDATE on rows that
> already exist, which is exactly the operation with no policy to allow it.
>
> **The RLS check firing at all, on a key that's supposed to be
> `service_role`, is the tell.** `service_role` doesn't consult policies —
> it skips RLS outright. The far more likely explanation, and the same
> mistake `STATUS.md` already documents happening once before on the
> *other* Supabase project's secret: **`RADAR_SUPABASE_SERVICE_KEY` is
> holding the `anon`/`publishable` key, not the real `service_role` one.**
> That also explains why `opportunities` still writes — anon's SELECT/
> INSERT/UPDATE/DELETE grant from the original Lovable schema still
> appears to be live, which means **Step 2 below (`anon can delete the
> board`) is very likely still open too**, not just theoretically open.
>
> **Fix:** Supabase dashboard → **sonar-radar** project → Project Settings
> → API → copy the **`service_role`** secret specifically (starts `eyJ...`,
> decode it or trust the dashboard label — the point is it must say
> `service_role`, not `anon` or `publishable`). Update the GitHub secret
> with that value (Settings → Secrets and variables → Actions →
> `RADAR_SUPABASE_SERVICE_KEY` → Update), then re-run **Refresh board** and
> read the step's own log: you want `synced 19 opportunities`, `synced 1
> past entries`, and `purged placeholder updates, synced N real audit
> entries` with no `401` anywhere. Do Step 2 in the same sitting — if the
> key was wrong, that hole was never actually closed.

**Written 2026-08-12 for Sibusiso K. Lethabo cannot do any of these: all
three need access to accounts you own.**

Short version: the pipeline works, everything is merged to `main`, and
**none of it reaches the live site.** One workflow step is being skipped
because two secrets are empty. Step 1 fixes that in about five minutes.
Step 2 closes a hole that currently lets any visitor delete the board.

Do them in this order — step 2 closes the door step 1 walks through.

---

## Step 1 — Add two secrets so the site actually updates

**Time:** ~5 min · **Unblocks:** everything below

### Why

`.github/workflows/refresh-board.yml` ends with a step that pushes the
verified board into sonar-radar's Supabase project. That step begins with:

```bash
if [ -z "$RADAR_SUPABASE_URL" ] || [ -z "$RADAR_SUPABASE_SERVICE_KEY" ]; then
  echo "::error::sonar-radar sync SKIPPED ..."
  exit 0
fi
```

Both variables are empty, so it exits immediately. Because it exits `0`, the
step shows a **green tick** — which is why this went unnoticed for a day.
Here is the actual log line from run #22:

```
RADAR_SUPABASE_URL:
RADAR_SUPABASE_SERVICE_KEY:
##[warning]RADAR_SUPABASE_URL/RADAR_SUPABASE_SERVICE_KEY not set
```

**Consequence:** `sync_radar.py` has never run in CI. The real data on the
site today is from the one time you ran it by hand. Everything committed
since — corrected board data, the purge of Lovable's fabricated audit
entries, new `source`/`went_live_on`/`noticed_on` fields — is sitting in the
repo, undelivered.

### Do this

1. **Supabase dashboard** → the **sonar-radar** project (the one the live
   site reads, *not* Lethabo's `SONAR` project).
2. **Project Settings → API**. Copy two values:
   - **Project URL** — `https://xxxxxxxx.supabase.co`
   - **`service_role`** secret — the long `eyJ...` string.
     ⚠️ Take `service_role`, **not** `anon`/`publishable`. The anon key
     cannot delete rows, so the purge of the fabricated entries will be
     skipped. (Everything else would still sync — the script degrades
     rather than failing — but you'd be leaving the fake entries up.)
3. **GitHub** → `Sibusiso-K/SONAR` → **Settings → Secrets and variables →
   Actions → New repository secret**. Add both, names exactly:

   | Name | Value |
   |---|---|
   | `RADAR_SUPABASE_URL` | the Project URL |
   | `RADAR_SUPABASE_SERVICE_KEY` | the `service_role` key |

4. **Actions → Refresh board → Run workflow.**

### How to know it worked

Open the run, expand **"Sync the board to sonar-radar's Supabase project"**.
You want to see real output, not a skip:

```
synced 16 opportunities
synced 6 past entries
purged placeholder updates, synced 9 real audit entries
```

Then hard-refresh the site (Cmd/Ctrl+Shift+R):
- **/updates** — "Takealot Engineering Hack", "Sasol Solve" and "ARC Prize"
  should be **gone** (all three are fabricated — see below), replaced by the
  real history: Gradhack Top-6 correction, Mintek application, Entelect
  registration, REEFPRINT abstract.
- **/radar** — cards should read `SOURCE  manual research`, not
  `SOURCE  SONAR data pipeline`.

If the step still says SKIPPED, the secret names don't match exactly —
they're case-sensitive.

---

## Step 2 — Close the hole that lets anyone delete the board

**Time:** ~2 min · **Severity: this is live right now**

### Why

Lovable's generated schema (`web/supabase/migrations/20260811105003_*.sql`)
contains:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO anon;
CREATE POLICY "opportunities open" ON public.opportunities
  FOR ALL TO anon USING (true) WITH CHECK (true);
```

The `anon` key is compiled into the JavaScript bundle every visitor
downloads — it is public by design and cannot be treated as a secret.
Combined with that grant, **anyone who opens `sonar-two-brown.vercel.app`
can delete the entire board from their browser console**, or insert
fabricated opportunities that render identically to verified ones.

On a project whose entire premise is that nothing unverified reaches the
surface, that is the worst available hole. Nobody has exploited it — the
link isn't public — but it should not stay open.

### Do this

Supabase dashboard → **sonar-radar** project → **SQL Editor** → paste the
contents of:

```
web/supabase/migrations/20260812_lock_down_anon_writes.sql
```

→ **Run**.

It revokes `anon` write access on `opportunities` and `past_opportunities`
(leaving read), so writes come only from CI's `service_role` key. It
deliberately leaves `watchlist` open — that's the no-login shared-star
feature working as designed, and the worst case there is cosmetic.

### How to know it worked

Re-run **Refresh board**. It should still sync fine (CI uses `service_role`,
which bypasses RLS). The site should still load normally — it only reads.

---

## Step 3 — Optional, but stops this recurring

### 3a. Let migrations run from CI — `SUPABASE_DB_URL`

Applying SQL has been the one thing that always needs a human, because
PostgREST (what our scripts speak) can move rows but can't `CREATE TABLE`.
`.github/workflows/migrate.yml` already exists to fix that.

- Supabase → **sonar-radar** → **Project Settings → Database → Connection
  string → URI**. Copy the `postgresql://...` string.
  *(This is a third, different credential — not the REST URL, not the JWT.)*
- Add as secret **`SUPABASE_DB_URL`**.
- Then: **Actions → Apply Supabase migrations → Run workflow**, pass a
  filename, optionally tick dry-run first.

With this, step 2 becomes a workflow run instead of a copy-paste, and future
schema changes stop needing you specifically.

### 3b. Add Lethabo to the Vercel project

The `sonar` Vercel project is under your account, so Lethabo can't see
deployments, build logs or runtime errors — only guess from GitHub Actions.

Vercel → **sonar** project → **Settings → Members → Invite** →
Lethabo's email.

---

## Reference — what's already working, so you don't re-debug it

| Thing | State |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (Lethabo's `SONAR` project) | ✅ set, verified |
| `GROQ_API_KEY` | ✅ set, extracting live |
| `AISA_API_KEY` | ✅ set, not yet called by any script |
| `watch-sources.yml` (6-hourly scrape) | ✅ running — 27 observations, 1 correctly rejected (3.7% span-check failure rate) |
| `editions` backfill | ✅ 4 verified prior editions loaded |
| Forecasting | ⏸ correctly silent — needs 2+ editions per event, every one has 1 |
| **sonar-radar sync** | ❌ **secrets set since 12 Aug, but every push-triggered run fails — see the 21 Aug update at the top** |
| **anon can delete the board** | ❌ **open — step 2** |

### The three fabricated entries, for reference

These are Lovable seed rows, not real events. None has ever been on the
board. Step 1 removes them:

- *"Takealot Engineering Hack has been unconfirmed for 92 days"*
- *"Sasol Solve prize pool marked conflicted"* — invented R50k/R120k figures
- *"ARC Prize winnability lowered to 12"*

Two more attach invented detail to real entries: *"BCG Platinion … deadline
2026-10-14 read directly from the official brief PDF"* (real deadline is
**2026-09-07**; no such PDF was read) and *"Entelect … Team of 4 registered"*
(it's a team of 2).

---

## If something doesn't work

Every failure mode found so far looked like success. Two examples, both real:
the npm/bun cache mismatch failed a step that reported green, and the sync
skip above exits `0`. **Don't trust a green tick — open the step and read its
stdout.** The workflows now emit `::error::` and a job-summary block when they
skip, specifically so this stops happening.
