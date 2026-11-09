import { expect, test } from "@playwright/test";
import { liveRows, loadFixture, mockSupabase, waitForSplashGone } from "./support";

const fixture = loadFixture();
const entry = liveRows(fixture)[0]!.id;

// Regression: the home page's radar was a fixed 380px square with a rotating
// layer wider than that, which widened the layout on phones and gave visitors
// sideways scrolling and a zoomed-out page.
for (const path of ["/", "/stats", "/radar", "/war-room", "/updates", `/o/${entry}`]) {
  test(`${path} does not scroll sideways`, async ({ page }) => {
    await mockSupabase(page, fixture);
    await page.goto(path);
    await waitForSplashGone(page);
    // Let data-driven sections render before measuring.
    await page.waitForTimeout(800);
    const { inner, scroll } = await page.evaluate(() => ({
      inner: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(scroll, `page is ${scroll}px wide in a ${inner}px viewport`).toBeLessThanOrEqual(inner);
  });
}
