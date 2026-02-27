import { defineConfig, devices } from "@playwright/test";

// Avoid Node warning: "NO_COLOR is ignored due to FORCE_COLOR being set"
// in Playwright worker/web-server child processes.
delete process.env.NO_COLOR;
process.env.FORCE_COLOR = "0";

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
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3099",
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
    command:
      'env -i PATH="$PATH" HOME="$HOME" SHELL="$SHELL" TERM="$TERM" NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SKIP_LOGIN_DEV=true NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001}" node node_modules/next/dist/bin/next dev -p 3099',
    url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3099",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
