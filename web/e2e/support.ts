import fs from "node:fs";
import path from "node:path";
import { expect, type Page, type Route } from "@playwright/test";

/** The fake Supabase origin the e2e build is compiled against (package.json: e2e:serve). */
export const SUPABASE_ORIGIN = "http://127.0.0.1:54321";

export type Row = Record<string, unknown> & { id: string; name: string };
export type Fixture = {
  opportunities: Row[];
  past_opportunities: Row[];
  updates: Row[];
};

export function loadFixture(): Fixture {
  const file = path.join(import.meta.dirname, ".generated", "board.json");
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Fixture;
}

/** Entries the site lists as live (the app filters on archived = false). */
export const liveRows = (f: Fixture) => f.opportunities.filter((o) => o["archived"] === false);
export const archivedRows = (f: Fixture) => f.opportunities.filter((o) => o["archived"] === true);

export type Write = { table: string; method: string; body: unknown };

type MockOptions = {
  /** Replace the opportunities the database returns (to test odd data). */
  opportunities?: Row[];
  /** Make every read fail with this HTTP status. */
  failWith?: number;
  /** Make every read fail at the network level, as if the database were down. */
  unreachable?: boolean;
};

/** A 1x1 transparent PNG. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

/**
 * Stands in for the Supabase REST API. Serves the fixture, applies the one
 * filter the app relies on (archived = false), and records writes so tests
 * can assert on what the site tried to send.
 */
export async function mockSupabase(page: Page, fixture: Fixture, opts: MockOptions = {}) {
  const writes: Write[] = [];

  // The app also pulls in third-party resources at runtime (web fonts, globe
  // textures, organisation logos). Tests must not depend on the network, and
  // a blocked request logs a console error, so every non-local request gets a
  // harmless empty response of the right type. The hosts are recorded so the
  // suite can report what the site depends on.
  const external = new Set<string>();
  await page.route(
    (url) => !["127.0.0.1", "localhost"].includes(url.hostname),
    (route) => {
      const req = route.request();
      external.add(new URL(req.url()).hostname);
      if (req.resourceType() === "image") {
        return route.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
      }
      const type = req.resourceType() === "stylesheet" ? "text/css" : "text/plain";
      return route.fulfill({ status: 200, contentType: type, body: "" });
    },
  );

  await page.route(`${SUPABASE_ORIGIN}/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());

    if (req.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }

    const table = url.pathname.split("/").pop() ?? "";
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        headers: { ...CORS, "content-type": "application/json" },
        body: JSON.stringify(body),
      });

    if (req.method() !== "GET") {
      let body: unknown = null;
      try {
        body = req.postDataJSON();
      } catch {
        body = req.postData();
      }
      writes.push({ table, method: req.method(), body });
      return json(201, []);
    }

    if (opts.unreachable) {
      return route.abort("connectionrefused");
    }

    if (opts.failWith) {
      return json(opts.failWith, { message: "simulated outage", code: "XX000" });
    }

    switch (table) {
      case "opportunities": {
        let rows = opts.opportunities ?? fixture.opportunities;
        if (url.searchParams.get("archived") === "eq.false") {
          rows = rows.filter((o) => o["archived"] === false);
        }
        return json(200, rows);
      }
      case "past_opportunities":
        return json(200, fixture.past_opportunities);
      case "updates":
        return json(200, fixture.updates);
      case "watchlist":
        return json(200, []);
      default:
        return json(404, { message: `unmocked table ${table}` });
    }
  });

  return { writes, external };
}

/** Collect uncaught errors and console errors so a test can assert there were none. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return {
    errors,
    expectNone: () =>
      expect(errors, `unexpected browser errors:\n${errors.join("\n")}`).toEqual([]),
  };
}

/** Wait for the opening splash to finish so it cannot cover what a test clicks. */
export async function waitForSplashGone(page: Page) {
  await expect(page.getByTestId("splash")).toHaveCount(0, { timeout: 6_000 });
}
