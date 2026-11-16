import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// In CI, `playwright install chromium` provides the browser. Where a Chromium
// is already installed elsewhere (a sandbox, a container image), point
// PLAYWRIGHT_CHROMIUM_EXECUTABLE at it instead of downloading another.
const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] || undefined;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"]
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      // The board the server-side assistant reads (see e2e/board-stub.mjs).
      command: "bun run e2e:board",
      url: "http://127.0.0.1:54329/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 30_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "bun run e2e:serve",
      url: `http://127.0.0.1:${PORT}`,
      reuseExistingServer: !process.env["CI"],
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
