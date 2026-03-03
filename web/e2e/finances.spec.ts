import { test, expect } from "@playwright/test";

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("Finances page", () => {
  test("loads with title and key sections", async ({ page }) => {
    await test.step("Navigate to Finances page", async () => {
      await page.goto("/finances");
    });
    await test.step("Verify title and main sections", async () => {
      const content = page.locator(".expenses-page-content");
      await expect(content.locator(".tests-page-title")).toHaveText("Finances");
      await expect(
        content.getByRole("heading", { name: /Summary/ })
      ).toBeVisible();
      await expect(
        content.getByRole("heading", { name: /Expenses/ })
      ).toBeVisible();
    });
  });

  test("shows guarded add/list when no project is selected", async ({
    page,
  }) => {
    await test.step("Navigate to Finances page", async () => {
      await page.goto("/finances");
    });
    await test.step("Verify project guard messages when no project selected", async () => {
      const content = page.locator(".expenses-page-content");
      await expect(
        content.getByText("Select a project to add expenses.", {
          exact: false,
        })
      ).toBeVisible();
      await expect(
        content.getByText("Select a project to see and manage expenses.", {
          exact: false,
        })
      ).toBeVisible();
    });
  });

  test("Summary section shows total and count with accessible labels", async ({
    page,
  }) => {
    await page.goto("/finances");
    const content = page.locator(".expenses-page-content");
    await expect(
      content.getByRole("heading", { name: /Summary/ })
    ).toBeVisible();
    const totalRegion = content.locator("[aria-label='Total amount']");
    await expect(totalRegion).toBeVisible();
    await expect(
      content.locator("[aria-label='Number of expenses']")
    ).toBeVisible();
  });

});

