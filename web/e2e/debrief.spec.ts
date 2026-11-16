import { expect, test } from "@playwright/test";
import { liveRows, loadFixture, mockSupabase, trackErrors, waitForSplashGone } from "./support";

const fixture = loadFixture();

/** A live row whose only date passed three days ago: the board should ask about it. */
function withFinishedEvent() {
  const done = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  const base = liveRows(fixture)[0]!;
  const finished = {
    ...base,
    id: "e2e-finished-hack",
    name: "E2E Finished Hackathon",
    next_date: null,
    confidence: "confirmed",
    status: "registered",
    dates: { submission_deadline: done },
  };
  // Every other row is made undated so only this one qualifies.
  const others = liveRows(fixture).map((o) => ({ ...o, next_date: null, dates: {} }));
  return [finished, ...others];
}

test.describe("debrief popup", () => {
  test("asks about a finished event and files what was written", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("sonar.identity", "Lethabo"));
    const errors = trackErrors(page);
    const { writes } = await mockSupabase(page, fixture, { opportunities: withFinishedEvent() });
    await page.goto("/");
    await waitForSplashGone(page);

    const dialog = page.getByTestId("debrief");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole("heading", { level: 2 })).toContainText(
      "E2E Finished Hackathon has passed",
    );

    // Saving needs an outcome first.
    const save = dialog.getByRole("button", { name: "Save to evaluation" });
    await expect(save).toBeDisabled();
    await dialog.getByRole("button", { name: "Entered, did not place" }).click();
    await expect(save).toBeEnabled();

    await save.click();
    await expect(dialog).toHaveCount(0);
    const filed = writes.find((w) => w.table === "debriefs");
    expect(filed?.method).toBe("POST");
    expect(filed?.body).toMatchObject({
      opportunity_id: "e2e-finished-hack",
      filed_by: "Lethabo",
      outcome: "entered",
    });
    // The database sets the time; a browser must not be able to backdate one.
    expect(filed?.body).not.toHaveProperty("created_at");
    errors.expectNone();
  });

  test("structures free text into fields, keeping only what was written", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("sonar.identity", "Sibusiso"));
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.200" });
    await mockSupabase(page, fixture, { opportunities: withFinishedEvent() });
    await page.goto("/");
    await waitForSplashGone(page);

    const dialog = page.getByTestId("debrief");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole("button", { name: "Placed" }).click();
    await dialog
      .getByRole("textbox")
      .fill("We placed 3rd after about 30 hours. The auth flow broke and cost us a morning.");
    await dialog.getByRole("button", { name: "Structure it" }).click();

    // The e2e server has no model key, so the built-in rules sort it.
    await expect(dialog.getByText("built-in rules")).toBeVisible({ timeout: 15_000 });
    // Read the filed fields, not the textarea that also contains the words.
    const filed = dialog.getByRole("complementary", { name: "What gets filed" });
    await expect(filed.getByText("3rd", { exact: true })).toBeVisible();
    await expect(filed.getByText("30", { exact: true })).toBeVisible();
    await expect(filed.getByText(/auth flow broke/)).toBeVisible();
  });

  test("asks nobody who has not picked a name, and stays away once put off", async ({ page }) => {
    await mockSupabase(page, fixture, { opportunities: withFinishedEvent() });
    await page.goto("/");
    await waitForSplashGone(page);
    await page.waitForTimeout(3_500);
    await expect(page.getByTestId("debrief")).toHaveCount(0);

    await page.evaluate(() => localStorage.setItem("sonar.identity", "Sibusiso"));
    await page.reload();
    const dialog = page.getByTestId("debrief");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole("button", { name: "Remind me tomorrow" }).click();
    await page.reload();
    await page.waitForTimeout(3_500);
    await expect(page.getByTestId("debrief")).toHaveCount(0);
  });
});

test.describe("crew", () => {
  test("each tab shows that person, and the record comes from the archive", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, fixture);
    await page.goto("/crew?who=Lethabo");
    await waitForSplashGone(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lethabo Hoaeane");
    await expect(page.getByRole("tab", { name: /Lethabo/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const placed = fixture.past_opportunities.find((p) => p["outcome"] === "placed");
    if (placed) await expect(page.getByText(String(placed["name"])).first()).toBeVisible();

    await page.getByRole("tab", { name: /Sibusiso/ }).click();
    await expect(page).toHaveURL(/who=Sibusiso/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sibusiso Khumalo");
    errors.expectNone();
  });
});

test.describe("background", () => {
  test("the sonar field is behind the page and never takes clicks", async ({ page }) => {
    await mockSupabase(page, fixture);
    await page.goto("/");
    await waitForSplashGone(page);
    const field = page.getByTestId("sonar-field");
    await expect(field).toBeAttached();
    const style = await field.evaluate((el) => {
      const s = getComputedStyle(el);
      return { pe: s.pointerEvents, z: s.zIndex, pos: s.position };
    });
    expect(style).toEqual({ pe: "none", z: "-10", pos: "fixed" });
  });
});
