import { defineConfig, devices } from "@playwright/test";

/**
 * UI (e2e) tests for the web app. Requires the backend (and DB) to be running
 * for full flows. Start with: pnpm db:up && pnpm dev:backend (in another terminal),
 * then run: pnpm test:e2e (from repo root) or pnpm test:e2e from web/.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    headless: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], headless: true } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], headless: true } },
    { name: "webkit", use: { ...devices["Desktop Safari"], headless: true } },
  ],
  webServer: {
    command: "pnpm dev",
    url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
