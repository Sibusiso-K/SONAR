# SONAR — web

The board, as a website. Hackathons, competitions, graduate programmes and
recruiting events, ranked by what closes first.

```
/          Board    everything live, soonest deadline first
/o/<id>    Detail   full brief, prize breakdown, scores, sources
/radar     Radar    unverified, predicted and conflicted — not calendar-safe
/updates   Updates  the audit trail: every change, and what made it
```

---

## Why this costs nothing to run

`next.config.mjs` sets `output: "export"`. There is no server, no database and
no serverless function — the whole site is HTML and CSS generated at build
time from `data/opportunities.json`, which lives in this repo.

That gives us, for free:

| | |
|---|---|
| **Hosting** | Vercel Hobby serves static files at no cost |
| **Database** | The repo. `data/opportunities.json` is the table, git is the write-ahead log |
| **Audit trail** | `git log`. Every change to the board is a reviewable diff |
| **Access control** | GitHub. Whoever can merge can change the board |
| **Rollback** | `git revert` |

The verification pipeline writes JSON and opens a PR. Merging it redeploys the
site. That's the whole loop.

> ⚠️ **The one thing you must not skip.** Countdowns are computed at build
> time, so a site that hasn't rebuilt since Tuesday will confidently tell you
> a deadline is 14 days away when it's 11. `.github/workflows/refresh-board.yml`
> rebuilds daily at 05:10 SAST. Set the `VERCEL_DEPLOY_HOOK` secret or that
> job no-ops with a warning.

---

## Local

```bash
# from the repo root — regenerate the board first
python3 scripts/migrate_to_opportunities.py

cd web
npm install
npm run dev        # syncs data, then starts on :3000
```

`npm run sync` copies `data/*.json` from the repo root into `web/data/`. It runs
automatically before `dev` and `build`. Keeping the copy explicit means Vercel's
Root Directory can be `web/` with no path trickery.

---

## Deploying to Vercel

1. **Import the repo** at [vercel.com/new](https://vercel.com/new).
2. **Set Root Directory to `web`.** This is the only setting that matters — without
   it Vercel looks for a Next app at the repo root and the build fails.
3. Framework preset: **Next.js**. Build command and output directory are detected;
   leave them alone.
4. Deploy.
5. **Create a Deploy Hook** — Project → Settings → Git → Deploy Hooks. Name it
   `daily-refresh`, target branch `main`. Copy the URL.
6. **Add it as a repo secret** — GitHub → Settings → Secrets and variables →
   Actions → New secret, named `VERCEL_DEPLOY_HOOK`.

No environment variables are needed. Nothing secret reaches the browser, because
nothing runs in the browser.

### Cost

Vercel Hobby covers this comfortably: ~22 static pages, ~103 kB of shared JS, one
build a day. Hobby is for non-commercial use — fine for a personal board, and if
it ever needs to become commercial, Pro is $20/month.

---

## Design

Custom tokens in `app/globals.css`, no UI framework. Three rules the code follows:

- **Brand and urgency are separate colour systems.** The petrol teal is brand and
  interaction only. Deadline pressure uses its own red/amber/green ramp, so a
  row screaming "3 days left" never competes with a button.
- **State is encoded in form, not just number.** Every row carries a left severity
  stripe, so the board is readable at a glance before you read a single digit.
- **Confidence is always visible.** An unverified date is rendered differently from
  a confirmed one everywhere it appears. Nothing on Radar is allowed to look
  like it belongs on the Board.

Typography is Geist and Geist Mono via `next/font`, self-hosted at build time.
Every number uses `tabular-nums` so columns align.

Light and dark are both first-class: tokens are defined on `:root`, redefined
under `prefers-color-scheme: dark`, and again under `[data-theme="dark"]` so an
explicit choice can override the OS in either direction.

---

## Adding a field

1. Add it to `data/opportunities.json` (via `scripts/migrate_to_opportunities.py`
   if it's derived).
2. Add it to `Opportunity` in `lib/types.ts`.
3. Render it. Keep formatting helpers in `lib/data.ts` rather than inline in
   components — `formatPrize`, `describeLink` and `dateLabel` are there because
   the board's real data is messier than it looks. One entry's `links` map
   contains an email address, several prizes are non-cash, and dates arrive in
   two timezones.
