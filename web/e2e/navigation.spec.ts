import { expect, test } from "@playwright/test";
import { liveRows, loadFixture, mockSupabase, trackErrors, waitForSplashGone } from "./support";

const fixture = loadFixture();

const SECTIONS = [
  { label: "Stats", path: "/stats" },
  { label: "Radar", path: "/radar" },
  { label: "War Room", path: "/war-room" },
  { label: "Updates", path: "/updates" },
] as const;

test.describe("sections", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page, fixture);
  });

  for (const { path } of SECTIONS) {
    test(`${path} loads with a heading and no browser errors`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(path);
      await waitForSplashGone(page);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      errors.expectNone();
    });
  }

  test("the sidebar moves between every section", async ({ page, isMobile }) => {
    test.skip(isMobile, "sidebar is an off-canvas drawer on mobile; covered by direct loads above");
    const errors = trackErrors(page);
    await page.goto("/");
    await waitForSplashGone(page);

    for (const { label, path } of SECTIONS) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    }
    await page.getByRole("link", { name: "Board", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    errors.expectNone();
  });

  test("browser back and forward work across sections", async ({ page, isMobile }) => {
    test.skip(isMobile, "uses the desktop sidebar");
    await page.goto("/");
    await waitForSplashGone(page);
    await page.getByRole("link", { name: "Stats", exact: true }).click();
    await expect(page).toHaveURL(/\/stats$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/stats$/);
  });

  test("transitions slide forward through the sections and back again", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "uses the desktop sidebar");
    // Record the view-transition types the router asks the browser for.
    await page.addInitScript(() => {
      const w = window as unknown as { __vt: unknown[] };
      w.__vt = [];
      const original = document.startViewTransition?.bind(document);
      if (original) {
        document.startViewTransition = ((arg: { types?: string[] }) => {
          w.__vt.push(arg && typeof arg === "object" ? arg.types : null);
          return original(arg as never);
        }) as typeof document.startViewTransition;
      }
    });
    await page.goto("/");
    await waitForSplashGone(page);

    const supported = await page.evaluate(() => typeof document.startViewTransition === "function");
    test.skip(!supported, "View Transitions API not available in this browser");

    const last = () =>
      page.evaluate(() => {
        const v = (window as unknown as { __vt: unknown[] }).__vt;
        return v[v.length - 1];
      });

    await page.getByRole("link", { name: "Radar", exact: true }).click();
    await expect(page).toHaveURL(/\/radar$/);
    expect(await last()).toEqual(["forward"]);

    await page.getByRole("link", { name: "Stats", exact: true }).click();
    await expect(page).toHaveURL(/\/stats$/);
    expect(await last()).toEqual(["backward"]);
  });

  test("the sidebar stays put during a transition (it is its own layer)", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "uses the desktop sidebar");
    await page.goto("/");
    await waitForSplashGone(page);
    const name = await page
      .locator("aside.vt-site-nav")
      .evaluate((el) => getComputedStyle(el).viewTransitionName);
    expect(name).toBe("site-nav");
  });

  test("unknown routes show the not-found page with a way home", async ({ page }) => {
    await page.goto("/definitely-not-a-page");
    await waitForSplashGone(page);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.getByRole("link", { name: "Go home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("an entry opens from the board and shows its name", async ({ page }) => {
    const target = liveRows(fixture)[0]!;
    await page.goto(`/o/${target.id}`);
    await waitForSplashGone(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(target.name);
  });
});
