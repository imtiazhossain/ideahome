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

  test("shows all-day events on the selected day above timed events", async ({
    page,
  }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;

    await page.route("**/calendar/events**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "evt-all-day",
            provider: "google",
            providerEventId: "evt-all-day",
            title: "All-day planning",
            description: null,
            location: null,
            startAt: `${dateKey}T00:00:00.000Z`,
            endAt: `${dateKey}T00:00:00.000Z`,
            isAllDay: true,
            timeZone: "UTC",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: `${dateKey}T00:00:00.000Z`,
            updatedAt: `${dateKey}T00:00:00.000Z`,
          },
          {
            id: "evt-timed",
            provider: "google",
            providerEventId: "evt-timed",
            title: "Team sync",
            description: null,
            location: null,
            startAt: `${dateKey}T15:00:00.000Z`,
            endAt: `${dateKey}T16:00:00.000Z`,
            isAllDay: false,
            timeZone: "UTC",
            status: "confirmed",
            etag: null,
            updatedAtProvider: null,
            lastSyncedAt: null,
            createdAt: `${dateKey}T00:00:00.000Z`,
            updatedAt: `${dateKey}T00:00:00.000Z`,
          },
        ]),
      });
    });

    await page.goto("/calendar");
    const items = page.locator(".calendar-events-list .calendar-event-item");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("All-day planning");
    await expect(items.nth(0)).toContainText("All day");
    await expect(items.nth(1)).toContainText("Team sync");
  });

  test("creates all-day events for the selected local day", async ({ page }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;
    let createdEvents: any[] = [];
    let createdRequestBody: any = null;

    await page.route("**/calendar/google/status**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          connected: true,
          selectedCalendarId: "primary",
          lastSyncedAt: null,
          connectedAt: null,
        }),
      });
    });

    await page.route("**/calendar/google/calendars**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "primary", summary: "Primary", primary: true }]),
      });
    });

    await page.route("**/calendar/events**", async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createdEvents),
        });
        return;
      }
      if (request.method() === "POST") {
        createdRequestBody = request.postDataJSON();
        const allDayDate =
          typeof createdRequestBody?.allDayDate === "string"
            ? createdRequestBody.allDayDate
            : dateKey;
        const created = {
          id: "evt-created",
          provider: "google",
          providerEventId: "evt-created",
          title: createdRequestBody?.title ?? "Untitled",
          description: null,
          location: null,
          startAt: `${allDayDate}T00:00:00.000Z`,
          endAt: `${allDayDate}T00:00:00.000Z`,
          isAllDay: true,
          timeZone: "America/New_York",
          status: "confirmed",
          etag: null,
          updatedAtProvider: null,
          lastSyncedAt: null,
          createdAt: `${allDayDate}T00:00:00.000Z`,
          updatedAt: `${allDayDate}T00:00:00.000Z`,
        };
        createdEvents = [created];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(created),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/calendar");
    await page.locator("#calendar-event-title").fill("Test all-day");
    await page.locator('input.ui-checkbox[type="checkbox"]').check();
    await page.getByRole("button", { name: "Create Event" }).click();

    await expect.poll(() => createdRequestBody?.allDayDate).toBe(dateKey);
  });
});
