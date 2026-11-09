import { expect, test } from "@playwright/test";
import {
  archivedRows,
  liveRows,
  loadFixture,
  mockSupabase,
  trackErrors,
  waitForSplashGone,
} from "./support";

const fixture = loadFixture();

test.describe("board", () => {
  test("lists the live entries from the data pipeline and hides archived ones", async ({
    page,
  }) => {
    await mockSupabase(page, fixture);
    const errors = trackErrors(page);
    await page.goto("/");
    await waitForSplashGone(page);

    const live = liveRows(fixture);
    const archived = archivedRows(fixture);
    expect(live.length, "fixture should contain live entries").toBeGreaterThan(5);
    expect(archived.length, "fixture should contain archived entries").toBeGreaterThan(0);

    // Every live entry has a link to its page; no archived one does.
    await expect(page.locator(`a[href="/o/${live[0]!.id}"]`).first()).toBeVisible();
    for (const row of live) {
      await expect(page.locator(`a[href="/o/${row.id}"]`).first()).toBeAttached();
    }
    for (const row of archived) {
      await expect(page.locator(`a[href="/o/${row.id}"]`)).toHaveCount(0);
    }
    errors.expectNone();
  });

  test("shows an error state, not an empty board, when the database fails", async ({ page }) => {
    test.setTimeout(45_000);
    await mockSupabase(page, fixture, { failWith: 500 });
    await page.goto("/");
    await waitForSplashGone(page);

    // react-query retries a few times before giving up.
    await expect(page.getByText("Couldn't load this").first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole("button", { name: /retry/i }).first()).toBeVisible();
  });

  test("an unreachable database also shows the error state", async ({ page }) => {
    test.setTimeout(45_000);
    await mockSupabase(page, fixture, { unreachable: true });
    await page.goto("/");
    await waitForSplashGone(page);
    await expect(page.getByText("Couldn't load this").first()).toBeVisible({ timeout: 25_000 });
  });

  test("renders hostile text as text, never as markup", async ({ page }) => {
    const payload = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>`;
    const evil = { ...liveRows(fixture)[0]!, name: payload, organiser: payload, notes: payload };
    await mockSupabase(page, fixture, { opportunities: [evil, ...liveRows(fixture).slice(1)] });
    await page.goto("/");
    await waitForSplashGone(page);
    await page.goto(`/o/${evil.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("<img src=x");

    expect(
      await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
    ).toBeUndefined();
    expect(await page.locator("main img[src='x']").count()).toBe(0);
  });
});
