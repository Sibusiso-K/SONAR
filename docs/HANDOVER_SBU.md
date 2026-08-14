# Handover — the blockers, and the way around them

> **UPDATE 2026-08-12, read this first.** Steps 1–3 below still stand and are
> still the *cleanest* fix. But they've been blocked on Sbu for days, so
> there is now a route that doesn't need him at all.
>
> **The root cause of every blocker here:** the pipeline database and the
> website's database live in different people's accounts. The pipeline writes
> to Lethabo's `SONAR` Supabase project; the site reads from sonar-radar's
> project in Sbu's account. So nothing the pipeline verifies can reach the
> site without a credential only Sbu can supply.
>
> **The fix:** an `app` schema now exists inside Lethabo's own project
> (`supabase/migrations/0004_app_schema_for_website.sql`, applied 2026-08-12)
> holding the same four tables the site expects, already populated with the
> real past entries and the full 9-entry audit trail. `refresh-board.yml`
> keeps it current using `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` — secrets that
> are **already set and verified working.**
>
> It is also built more safely than the schema it replaces: `anon` gets
> SELECT only on board data, so the "any visitor can delete the board" hole
> in step 2 cannot exist there by construction.
>
> **To switch the site over — two env vars, no Sbu:**
>
> | Variable | Value |
> |---|---|
> | `VITE_SUPABASE_URL` | `https://txmxygjqndenkcdpweym.supabase.co` |
> | `VITE_SUPABASE_PUBLISHABLE_KEY` | that project's **anon/publishable** key (Supabase → SONAR → Project Settings → API) |
> | `VITE_SUPABASE_SCHEMA` | `app` |
>
> Set them wherever the app's env lives — Lovable's project settings (Lethabo
> now has access) or Vercel. The site then reads from a database Lethabo
> controls, and every future pipeline run reaches it automatically.
>
> Nothing below is wasted if you do this: Sbu's steps 1–3 remain worth doing
> to keep the existing deployment healthy and to close the anon-delete hole
> on the old project. This just stops the board being frozen while waiting.

---

# Sbu — 3 things only you can do

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
| **sonar-radar sync** | ❌ **never run — step 1** |
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
