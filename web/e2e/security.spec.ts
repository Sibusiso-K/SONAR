import { expect, test } from "@playwright/test";
import { loadFixture, mockSupabase } from "./support";

const fixture = loadFixture();

const HEADERS = [
  ["x-content-type-options", /nosniff/],
  ["referrer-policy", /strict-origin-when-cross-origin/],
  ["content-security-policy", /frame-ancestors 'self'/],
  ["content-security-policy", /object-src 'none'/],
  ["strict-transport-security", /max-age=\d+/],
  ["permissions-policy", /camera=\(\)/],
  ["cross-origin-opener-policy", /same-origin/],
] as const;

test.describe("security headers", () => {
  for (const path of ["/", "/stats", "/does-not-exist"]) {
    test(`${path} carries the security headers`, async ({ page }) => {
      await mockSupabase(page, fixture);
      const res = await page.goto(path);
      const headers = res!.headers();
      for (const [name, pattern] of HEADERS) {
        expect(headers[name], `${name} on ${path}`).toMatch(pattern);
      }
    });
  }

  test("the CSP does not restrict script-src (it would break hydration)", async ({ page }) => {
    await mockSupabase(page, fixture);
    const res = await page.goto("/");
    expect(res!.headers()["content-security-policy"]).not.toMatch(/script-src/);
  });
});

test.describe("no secrets reach the browser", () => {
  test("served HTML and JS contain no server-side keys or service-role references", async ({
    page,
    request,
  }) => {
    await mockSupabase(page, fixture);
    const html = await (await request.get("/")).text();
    const assets = new Set<string>();
    for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)) assets.add(m[1]!);
    expect(assets.size, "expected to find script bundles").toBeGreaterThan(0);

    const bodies = [html];
    for (const asset of assets) bodies.push(await (await request.get(asset)).text());
    const all = bodies.join("\n");

    // Names of server-only settings must not appear as readable references.
    for (const pattern of [/SUPABASE_SERVICE/i, /GROQ_API_KEY/, /\bgsk_[A-Za-z0-9]{10,}/]) {
      expect(all).not.toMatch(pattern);
    }
    // Real key-shaped values: a Supabase secret key, or any JWT whose role is
    // service_role. (The Supabase library contains the literal text
    // "sb_secret_" and "service_role" in its own warnings, so match values,
    // not words.)
    expect(all).not.toMatch(/sb_secret_[A-Za-z0-9_-]{20,}/);
    for (const jwt of all.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ??
      []) {
      const payload = JSON.parse(
        Buffer.from(jwt.split(".")[1]!, "base64url").toString("utf-8"),
      ) as {
        role?: string;
      };
      expect(payload.role, "a service-role JWT is embedded in the client bundle").not.toBe(
        "service_role",
      );
    }
  });

  test("static files that should exist do", async ({ request }) => {
    expect((await request.get("/favicon.ico")).status()).toBe(200);
    expect((await request.get("/robots.txt")).status()).toBe(200);
  });
});
