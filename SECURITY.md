# Security policy

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private reporting:
<https://github.com/Sibusiso-K/SONAR/security/advisories/new>

Include what you found, how to reproduce it, and what an attacker could do with it. You will get an acknowledgement within a few days. SONAR is run by two people, so please allow time for a fix, and please do not test against the live site's data in a way that could damage it.

## Scope

In scope: this repository, the deployed site, the GitHub Actions workflows, the database migrations and policies. Out of scope: Vercel, Supabase, Groq and GitHub themselves; report those to the vendor.

## Security model in brief

- The site's database key is **public** (it is compiled into the browser bundle). Row Level Security makes it read-only on the board. Check it with [`supabase/audit/rls_audit.sql`](supabase/audit/rls_audit.sql).
- All writes to the board come from GitHub Actions using service keys held only in GitHub Secrets.
- The `watchlist` and the watch-action rows in `updates` are deliberately writable without a login (a two-person shared board). They are bounded and documented in [`web/supabase/migrations`](web/supabase/migrations).
- The assistant endpoint is unauthenticated, rate-limited, size-capped, and returns no upstream error detail.
- Scraped pages are untrusted input to a language model; hidden text is stripped and every extracted fact needs an exact supporting quote.

Details and open items: [docs/SECURITY_REVIEW_2026-11-09.md](docs/SECURITY_REVIEW_2026-11-09.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## If you find a secret in the repository

Rotate it before anything else, then follow [docs/RUNBOOK.md](docs/RUNBOOK.md#rotate-a-key).

## Dependencies

Dependabot proposes updates weekly. CI fails on `high` or `critical` advisories in the web app's dependencies (`bun audit`) and on `bandit` findings in the scripts. CodeQL runs on every pull request and weekly.
