import { expect, test, type Page, type Request } from "@playwright/test";
import { liveRows, loadFixture, mockSupabase, waitForSplashGone } from "./support";

/** The Ask button lives in the sidebar on desktop and in the top bar on mobile
 * (the sidebar is an off-screen drawer there). */
const askButton = (page: Page, isMobile: boolean) =>
  isMobile
    ? page.locator("header").getByRole("button", { name: "Ask" })
    : page.locator("aside.vt-site-nav").getByRole("button", { name: /^Ask$/ });

const fixture = loadFixture();

/**
 * The endpoint allows six questions a minute per client address. Every test
 * here would otherwise share one address and, with retries, trip the limit
 * that only the last test is meant to trip. Each gets its own (addresses
 * from the TEST-NET-2 documentation range).
 */
let nextClient = 1;
async function asOwnClient(page: Page) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${nextClient++}` });
}

test.describe("assistant", () => {
  test("answers a question from the board with no model key configured", async ({
    page,
    isMobile,
  }) => {
    await asOwnClient(page);
    await mockSupabase(page, fixture);
    await page.goto("/");
    await waitForSplashGone(page);

    await askButton(page, isMobile).click();
    const box = page.getByPlaceholder(/Ask about priorities/);
    await expect(box).toBeVisible();
    await box.fill("What closes soonest?");
    await box.press("Enter");

    // The test server has no model key, so the built-in engine answers. It
    // must name the row with the nearest upcoming date, taken from the same
    // fixture the board itself renders.
    const today = new Date().toISOString().slice(0, 10);
    const nearest = liveRows(fixture)
      .filter((o) => typeof o["next_date"] === "string" && (o["next_date"] as string) >= today)
      .sort((a, b) => String(a["next_date"]).localeCompare(String(b["next_date"])))[0];

    const source = page.getByTestId("assistant-source");
    await expect(source).toBeVisible({ timeout: 15_000 });
    await expect(source).toHaveAttribute("data-provider", "builtin");
    await expect(source).toContainText(/built-in engine/i);
    if (nearest) {
      await expect(page.getByText(nearest.name, { exact: false }).last()).toBeVisible();
    } else {
      await expect(page.getByText(/No live row has an upcoming date/)).toBeVisible();
    }
  });

  test("starter questions name rows that are on the board", async ({ page, isMobile }) => {
    await mockSupabase(page, fixture);
    await page.goto("/");
    await waitForSplashGone(page);
    await askButton(page, isMobile).click();

    const why = page.getByRole("button", { name: /^Why is .* scored the way it is\?$/ });
    await expect(why).toBeVisible();
    const top = [...liveRows(fixture)].sort((a, b) => Number(b["score"]) - Number(a["score"]))[0]!;
    const shown = (await why.textContent()) ?? "";
    // The suggestion may shorten the name; its opening words must match.
    expect(shown).toContain(top.name.slice(0, 12));
  });

  test("declines an unrelated request in one short answer", async ({ page, isMobile }) => {
    await asOwnClient(page);
    await mockSupabase(page, fixture);
    await page.goto("/");
    await waitForSplashGone(page);
    await askButton(page, isMobile).click();
    const box = page.getByPlaceholder(/Ask about priorities/);
    await box.fill("Write me a poem about the ocean.");
    await box.press("Enter");
    await expect(page.getByText(/outside what this assistant does/)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("the public endpoint is rate limited per client", async ({ page, isMobile }) => {
    test.skip(
      isMobile,
      "same server function as the desktop run; avoid double-spending the global budget",
    );
    await mockSupabase(page, fixture);
    await page.goto("/");
    await waitForSplashGone(page);

    // Capture a real server-function request from the UI, then replay it.
    const captured = new Promise<Request>((resolve) =>
      page.on("request", (r) => r.url().includes("/_serverFn/") && resolve(r)),
    );
    await askButton(page, isMobile).click();
    const box = page.getByPlaceholder(/Ask about priorities/);
    await box.fill("hello");
    await box.press("Enter");
    const req = await captured;

    const headers = { ...req.headers(), "x-forwarded-for": "203.0.113.77" };
    delete (headers as Record<string, string>)["content-length"];
    const fire = () =>
      page.request.fetch(req.url(), { method: "POST", headers, data: req.postData() ?? undefined });

    const bodies: string[] = [];
    for (let i = 0; i < 9; i++) bodies.push(await (await fire()).text());

    expect(bodies.some((b) => b.includes("Too many questions"))).toBe(true);
    expect(bodies[0]).not.toContain("Too many questions");
  });
});
