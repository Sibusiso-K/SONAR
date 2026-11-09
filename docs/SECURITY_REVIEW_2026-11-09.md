# Security review, 9 November 2026

A full pass over the repository, the web app, the workflows and the database migrations, with fixes made in the same change. This records what was found, what was done, what was verified, and what still needs a person.

**Scope.** Git history (280 commits) and working tree; `scripts/` (Python); `web/` (TanStack Start); `.github/workflows/`; `supabase/` and `web/supabase/` migrations; the deployed Vercel project's configuration (names of variables only, never values).

**Method.** Pattern scan for secrets across history; `bun audit`; `bandit` and `ruff` rules for security; manual review of the server function, provider layer and Supabase clients; review of every workflow for permissions and injection; static analysis of migrations; runtime checks of response headers and bundle contents against a production build; third-party request inventory.

**Not covered.** The live Supabase projects (credentials are stored as sensitive in Vercel and were not read; see O-1), penetration testing of Vercel or Supabase themselves, and a code-signing or SBOM review.

## Summary

| | Count |
|---|---|
| Findings fixed in this change | 11 |
| Items verified clean | 6 |
| Open items needing an owner decision or action | 9 |
| Secrets found in the repository or its history | **0** |

## Fixed

| # | Severity | Finding | Fix |
|---|---|---|---|
| S-1 | High | **32 known vulnerabilities in web dependencies**, including 2 critical (`shell-quote` command injection, `seroval` deserialisation) and 18 high, mostly transitive through the build toolchain and `vite` 8.2.0. | `bun audit fix` cleared 30 within version ranges. `zod` was upgraded 3 to 4 (high, unbounded memory on oversized input; it is used in one place and the upgrade was verified). One moderate remains (`minimatch`, dev-only, blocked by `typescript-eslint`). CI now fails on high or critical. |
| S-2 | Medium | **The assistant endpoint was public, unauthenticated and unlimited**, and each call spends about 6,000 LLM tokens. Anyone with the URL could run up the bill or exhaust the provider quota for everyone. | Per-client (6/min) and global (30/min) limits, and a total-size cap shared with the client so legitimate long conversations still fit. Both are tested, including the case where a naive size cap would have broken long chats. |
| S-3 | Medium | **Upstream error detail reached anonymous visitors**: up to 200 characters of the Groq response (organisation details, exact quota figures) and the raw database error message. | Details go to the server log; visitors get the status or a plain sentence. |
| S-4 | Medium | **Shell injection and path traversal in workflows.** `watch-sources.yml` interpolated a dispatch input into a shell command; `migrate.yml` accepted a filename like `../../x` and interpolated a step output into shell. | Inputs go through the environment and are validated (`limit` must be digits; the migration name must be a bare `*.sql` filename). Exercised with hostile values. |
| S-5 | Low to medium | **Third-party actions were referenced by mutable tag**, with no job timeouts. | Pinned to commit SHAs; timeouts added; Dependabot keeps them current. |
| S-6 | Medium | **Links from data were rendered without checking the scheme.** A `javascript:` URL in an entry's `links` would run on click. | All data-driven hrefs go through `safeHref()` (http and https only); `rel="noopener noreferrer"`. Covered by unit tests and a browser test with hostile data. |
| S-7 | Low | **No security response headers.** | Applied to every response at the server entry: CSP (`frame-ancestors`, `base-uri`, `object-src`, `form-action`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS. Verified on a running build. |
| S-8 | Medium | **The live-database sync could delete the board.** `delete_not_in` removed every row missing from the source file, so a truncated `opportunities.json` would wipe most of the live board and report success. | Refuses to delete more than half of a table (tables under six rows are exempt). Tested at the boundaries. |
| S-9 | Low | **`urllib.request.urlopen` accepted any scheme** (bandit B310, five sites): `file://` or `ftp://` from a bad config value or pipeline-written URL. | Every call goes through `safe_urlopen()` (https; plain http only to loopback). |
| S-10 | Low | **`bun.lock` pointed 8 packages (the `@supabase/*` family) at a private package cache** (`europe-west1-npm.pkg.dev/lovable-core-prod/...`), breaking installs outside that network. | Rewritten to the default registry. The public registry serves identical bytes: integrity hashes match, and `bun install --frozen-lockfile` verifies them. |
| S-11 | Info | `.env.example` contained a real Supabase project URL. | Placeholders; web and pipeline templates separated. |

## Verified clean

- **No secrets in the tree or in all 280 commits** (JWT, `sb_secret_`, `sk-`, `gsk_`, `ghp_`, AWS, Slack, private-key, database-URL and Google key patterns). This is a pattern scan, not a replacement for `gitleaks`; GitGuardian also scans every pull request.
- **No `dangerouslySetInnerHTML`.** Two `innerHTML` writes exist (`EventGlobe`, `Scatter3D`); both interpolate only computed values or `escapeHtml()`-escaped text.
- **The service-role client is imported nowhere** in browser code, and the production bundle contains no service-role key, `GROQ_API_KEY` or `sb_secret_` value (browser test decodes every JWT in the bundle and asserts none has `role: service_role`).
- **CSRF middleware is active** on server functions.
- **Hostile data renders as text**, not markup (browser test with an `<img onerror>` payload in names and notes).
- **Vercel environment variables are stored as sensitive**, and production is behind Vercel Authentication. The Vercel runtime-error log shows no errors in the last 7 days.

## Open

| # | Item | Why it matters | Recommended action |
|---|---|---|---|
| **O-1** | **The live database's actual Row Level Security state is unverified.** The migrations lock the board tables down (statically verified), but the repo cannot show they were *applied*. The `20260914_lock_down_updates_insert.sql` header says "Not applied by this commit", and the nightly sync to the app-schema mirror failed for weeks with `PGRST204` because migration `0005` had never been applied there, which shows migrations in this repo are not reliably applied. | The anon key is public. If the lockdown migrations are not applied, any visitor could rewrite the board. | Run [`supabase/audit/rls_audit.sql`](../supabase/audit/rls_audit.sql) in the live-site project and compare with each query's stated expectation. If anything differs, apply the missing migration with the **Apply Supabase migrations** workflow. |
| O-2 | `watchlist` is world-writable by design, including delete and update. | Anyone who reaches the site can alter or spam the shared watchlist; no bound on rows or field length. | Acceptable while the site is behind Vercel sign-in. If it is ever opened up, add length checks and a per-day insert cap. |
| O-3 | The rate limiter is per warm server instance. | A determined caller reaching many instances gets more than the stated limit. It stops casual hammering, not a distributed attack. | Use Vercel's edge rate limiting or a shared store if the assistant's cost ever matters. |
| O-4 | The CSP has no `script-src`. | Without it, an XSS bug is not contained by CSP. | Needs a per-request nonce threaded through TanStack Start's inline hydration scripts; a half-working strict policy would break the site, so it was left out deliberately. |
| O-5 | **Third-party requests from the browser:** `www.google.com/s2/favicons` (11 requests per session, one per organiser), `fonts.googleapis.com`, and `unpkg.com` (globe texture, **unpinned version**). | Google learns which opportunities you view; unpkg is a floating dependency. | Self-host the font and globe texture; replace the favicon service with stored logos. This also lets the CSP restrict `img-src`, `font-src` and `style-src`. **Resolved:** fonts are bundled from npm, the globe texture is served from `web/public/textures/`, the favicon service is replaced by initials badges, and the CSP restricts `img-src`, `font-src` and `style-src`. A test fails if a third-party host reappears in `web/src`. |
| O-6 | **Preview deployments use the production Supabase and Groq variables** (the same variables target preview and production). | A branch preview talks to the live database and spends the production LLM quota. With read-only RLS the exposure is small. | Give preview its own keys, or at least its own Groq key with a spend limit. |
| O-7 | `VERCEL_DEPLOY_HOOK` may be unset, and the workflow step succeeds either way. Production did not deploy after the 9 Nov merge until it was redeployed by hand. | A silent no-op. The site reads data live, so data is unaffected; code changes still deploy through Vercel's Git integration. | Confirm in Vercel that Git deploys on `main` are enabled; decide whether the hook is still needed. **Status:** the hook secret is unset. Vercel's Git integration deployed both 9 Nov pushes (the PR #31 merge and the bot's data commit) on its own, so the hook is an optional backup, and the workflow now says so instead of warning that countdowns will go stale. |
| O-8 | **No `LICENSE`, and branch protection could not be inspected.** | Without a licence the code is all-rights-reserved by default; without required checks anyone with write access can merge a red build. | Choose a licence (an owner decision). Require the **CI result** check and a review on `main`. **Status:** the licence is resolved: all rights reserved, stated in `COPYRIGHT.md`. Branch protection is still open. The automation token gets HTTP 403 on branch protection, so it could not be checked. Protection that blocks direct pushes must also allow the `sonar-bot` data commits in the Refresh board workflow. |
| O-9 | 27 older entries have a legacy `prize` shape that does not validate; the assistant's prompt prints `prize.breakdown` as `[object Object]` for them. | Data quality, and the assistant is told wrong things. | Migrate them to the array shape, removing each from `LEGACY_SCHEMA_DEBT` as you go. The test makes the list shrink-only. **Resolved:** all 27 entries are migrated and the list is empty. The assistant formats the breakdown array with `formatPrizeBreakdown` (`web/src/lib/prize.ts`). |

## How to re-verify

```bash
make audit                                  # bun audit (high+) and bandit
make check                                  # includes data-integrity and migration tests
python3 scripts/smoke_check.py <site-url>   # headers, 404 behaviour, bundle caching
# and in the live-site Supabase SQL editor: supabase/audit/rls_audit.sql
```
