import { expect, test, type Page, type Request } from "@playwright/test";
import { loadFixture, mockSupabase, waitForSplashGone } from "./support";

/** The Ask button lives in the sidebar on desktop and in the top bar on mobile
 * (the sidebar is an off-screen drawer there). */
const askButton = (page: Page, isMobile: boolean) =>
  isMobile
    ? page.locator("header").getByRole("button", { name: "Ask" })
    : page.locator("aside.vt-site-nav").getByRole("button", { name: /^Ask$/ });

const fixture = loadFixture();

test.describe("assistant", () => {
  test("opens, accepts a question, and shows a reply or a clear error", async ({
    page,
    isMobile,
  }) => {
    await mockSupabase(page, fixture);
    await page.goto("/");
    await waitForSplashGone(page);

    await askButton(page, isMobile).click();
    const box = page.getByPlaceholder(/Ask about priorities/);
    await expect(box).toBeVisible();
    await box.fill("What closes soonest?");
    await box.press("Enter");

    // The test server has no database or model configured, so the assistant
    // must answer with an explanation rather than hang or crash.
    await expect(
      page.getByText(/not configured|could not answer|didn't get through/i).first(),
    ).toBeVisible({
      timeout: 15_000,
    });
    test.info().annotations.push({ type: "mobile", description: String(isMobile) });
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
