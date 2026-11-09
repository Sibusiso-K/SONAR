import { expect, test } from "@playwright/test";
import { loadFixture, mockSupabase, trackErrors } from "./support";

const fixture = loadFixture();

test.describe("opening splash", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page, fixture);
  });

  test("is in the server-rendered page and then lifts away on its own", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/", { waitUntil: "commit" });

    const splash = page.getByTestId("splash");
    await expect(splash).toBeVisible();
    await expect(splash).toHaveAccessibleName("Loading SONAR");

    // Gone within the timeline (lift 1.7s + exit 0.65s), well inside 6s.
    await expect(splash).toHaveCount(0, { timeout: 6_000 });
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    errors.expectNone();
  });

  test("plays once per session: a reload goes straight to the board", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("splash")).toHaveCount(0, { timeout: 6_000 });
    expect(await page.evaluate(() => sessionStorage.getItem("sonar.splash.seen"))).toBe("1");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-splash", "off");
    await expect(page.getByTestId("splash")).toBeHidden();
  });

  test("can be skipped with a click", async ({ page }) => {
    await page.goto("/", { waitUntil: "commit" });
    const splash = page.getByTestId("splash");
    await expect(splash).toBeVisible();
    await expect(splash).toHaveAttribute("data-ready", "true");
    const started = Date.now();
    await splash.click();
    await expect(splash).toHaveCount(0, { timeout: 2_000 });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  test("can be skipped with a key press", async ({ page }) => {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.getByTestId("splash")).toBeVisible();
    await expect(page.getByTestId("splash")).toHaveAttribute("data-ready", "true");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("splash")).toHaveCount(0, { timeout: 2_000 });
  });

  test("applies the saved dark theme before first paint, not after", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("sonar.theme", "dark"));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("survives blocked storage", async ({ page }) => {
    await page.addInitScript(() => {
      const boom = () => {
        throw new DOMException("blocked", "SecurityError");
      };
      Object.defineProperty(window, "sessionStorage", { get: boom });
      Object.defineProperty(window, "localStorage", { get: boom });
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.getByTestId("splash")).toBeVisible();
    await expect(page.getByTestId("splash")).toHaveCount(0, { timeout: 6_000 });
    expect(errors.filter((m) => /SecurityError|blocked/.test(m))).toEqual([]);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("never shows the splash", async ({ page }) => {
    await mockSupabase(page, fixture);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-splash", "off");
    await expect(page.getByTestId("splash")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });
});
