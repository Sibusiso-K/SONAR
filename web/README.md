# SONAR web app

The site behind the board: Board, Stats, Radar, War Room and Updates views, an entry page, and an assistant that answers questions about the board.

**Stack:** [TanStack Start](https://tanstack.com/start) and Router on React 19, Vite 8 with Nitro, Tailwind 4 and shadcn/ui, TanStack Query, the Supabase JS client. Built with [Bun](https://bun.sh). Deployed on Vercel.

For how this fits the rest of the system, see the [root README](../README.md) and [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Develop

```bash
bun install --frozen-lockfile
cp .env.example .env            # fill in the VITE_SUPABASE_* values
bun run dev                     # http://localhost:8080
```

| Script | Does |
|---|---|
| `bun run dev` | Dev server |
| `bun run build` | Production build (Nitro; targets Vercel on Vercel, Cloudflare by default elsewhere) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` / `lint:fix` | ESLint with Prettier |
| `bun run test` | Unit tests (Vitest) |
| `bun run test:e2e` | Browser tests (Playwright); builds a Node-server bundle and serves fixtures |
| `bun run check` | typecheck + lint + unit tests |

## How the data gets here

The deployed bundle contains **no board data**. The browser reads the live-site Supabase project when a page loads, so a data change shows up without a redeploy. The project is filled by `scripts/sync_radar.py` from `data/opportunities.json`; see [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Layout

```
src/
  routes/            one file per page (TanStack file routing); routeTree.gen.ts is generated
  components/        app components; components/ui/ is generated shadcn/ui
  lib/               pure logic: analytics, formatting, dates, safe-url, rate-limit,
                     security-headers, splash, page-transition, assistant limits/providers
  integrations/supabase/   the browser client, the server-only admin client, generated types
e2e/                 Playwright specs and the Supabase mock
supabase/migrations/ database migrations for the live-site project
```

## Things to know before changing it

- **Dates and numbers.** The board lives in `Africa/Johannesburg`. Use `boardDateKey()` and `daysUntil()` from `lib/analytics.ts` and `formatNumber()` from `lib/format.ts`. `new Date()` and `toLocaleString("en-ZA")` give different results on the server and in the browser, which breaks hydration.
- **Client-only libraries.** `three` and `react-globe.gl` touch `window` when imported. Load them lazily inside `ClientOnly` (see the scatter on `/stats` and `EventGlobe`), or server rendering aborts for the whole page.
- **Links from data** go through `safeHref()`. **Public server functions** that cost money need a rate limit (`lib/rate-limit.ts`).
- **Security headers** are applied for every response in `src/server.ts`. The CSP is deliberately partial; see the comment in `lib/security-headers.ts` before tightening it.
- **The opening animation and section transitions** are CSS plus `lib/splash.ts` and `lib/page-transition.ts`. They respect `prefers-reduced-motion`.
- **`bun.lock`** must resolve from the public npm registry. Commit it with any dependency change.
