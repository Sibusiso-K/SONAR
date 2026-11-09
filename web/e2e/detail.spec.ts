import { expect, test } from "@playwright/test";
import { liveRows, loadFixture, mockSupabase, waitForSplashGone } from "./support";

const fixture = loadFixture();

test.describe("entry page", () => {
  test("says so plainly when the id does not exist", async ({ page }) => {
    await mockSupabase(page, fixture);
    await page.goto("/o/no-such-entry");
    await waitForSplashGone(page);
    await expect(page.getByText("No entry with that id.")).toBeVisible();
  });

  test("only renders http(s) links, with safe rel attributes", async ({ page }) => {
    const base = liveRows(fixture)[0]!;
    const hostile = {
      ...base,
      links: {
        main: "https://example.com/ok",
        script: "javascript:alert(document.cookie)",
        mixedcase: "JaVaScRiPt:alert(1)",
        data: "data:text/html,<script>alert(1)</script>",
        relative: "/admin",
        mail: "mailto:x@example.com",
      },
    };
    await mockSupabase(page, fixture, { opportunities: [hostile, ...liveRows(fixture).slice(1)] });
    await page.goto(`/o/${base.id}`);
    await waitForSplashGone(page);

    const links = page.locator("main a[target='_blank']");
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveAttribute("href", "https://example.com/ok");
    const rel = (await links.first().getAttribute("rel")) ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");

    for (const scheme of ["javascript:", "data:", "mailto:"]) {
      await expect(page.locator(`a[href^="${scheme}" i]`)).toHaveCount(0);
    }
  });

  test("shows a countdown or date for an entry with a next date", async ({ page }) => {
    const dated = liveRows(fixture).find((o) => o["next_date"]);
    test.skip(!dated, "no live entry with a next date in the current data");
    await mockSupabase(page, fixture);
    await page.goto(`/o/${dated!.id}`);
    await waitForSplashGone(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(dated!.name);
  });
});
