import { expect, test } from "@playwright/test";

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("Calendar page", () => {
  test("loads with calendar title and month grid", async ({ page }) => {
    await page.goto("/calendar");
    const content = page.locator(".calendar-page-content");
    await expect(content.locator(".tests-page-title")).toHaveText("Calendar");
    await expect(content.locator(".calendar-month-grid")).toBeVisible();
  });

  test("has Google connect card and selected-day picker", async ({ page }) => {
    await page.goto("/calendar");
    const content = page.locator(".calendar-page-content");
    await expect(content.locator(".calendar-sync-card")).toBeVisible();
    await expect(
      content.getByRole("button", { name: /Connect Google Calendar|Reconnect Google/ })
    ).toBeVisible();
    await expect(content.locator(".calendar-date-filter")).toBeVisible();
  });

  test("date picker opens from selected-day control", async ({ page }) => {
    await page.goto("/calendar");
    const trigger = page.locator(".calendar-date-filter .expenses-date-filter-trigger");
    await trigger.click();
    await expect(page.locator(".calendar-picker-popup")).toBeVisible();
  });
});
