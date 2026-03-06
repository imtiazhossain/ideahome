import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.afterEach(async ({ page }) => {
  await page.close();
});

async function seedAuthAndMocks(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("ideahome_token", "e2e-token");
    sessionStorage.setItem("ideahome_token_session", "e2e-token");
    document.cookie = "ideahome_token=e2e-token; Path=/; SameSite=Lax";
  });

  await page.route("**/projects*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "proj-e2e", name: "E2E Project" }]),
    });
  });

  await page.route("**/calendar/google/status**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        connected: false,
        selectedCalendarId: null,
        lastSyncedAt: null,
        connectedAt: null,
      }),
    });
  });
  await page.route("**/calendar/events**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }
    await route.continue();
  });
}

test.describe("Calendar page", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthAndMocks(page);
  });

  test("loads with calendar title and month grid", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.locator(".calendar-page-content .tests-page-title")).toHaveText(
      "Calendar"
    );
    await expect(page.locator(".calendar-month-grid")).toBeVisible();
  });

  test("has Google connect card", async ({ page }) => {
    await page.goto("/calendar");
    const content = page.locator(".calendar-page-content");
    await expect(content.locator(".calendar-sync-card")).toBeVisible();
    await expect(
      content.getByRole("button", { name: /Connect Google Calendar|Reconnect Google/ })
    ).toBeVisible();
  });
});
