import { test, expect } from "@playwright/test";

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("Code page", () => {
  test("shows title and initial codebase rating", async ({ page }) => {
    await test.step("Navigate to code page", async () => {
      await page.goto("/code");
    });
    await test.step("Verify title and codebase rating section", async () => {
      await expect(page.locator(".code-page-title")).toHaveText("Code");
      await expect(
        page.getByRole("heading", { name: "Codebase rating" })
      ).toBeVisible();
      await expect(
        page.locator(".code-page-rating-score-value").first()
      ).toHaveText("7.5/10");
    });
  });

  test("Codebase rating section has staff prompt and Copy button", async ({
    page,
  }) => {
    await page.goto("/code");
    await expect(
      page.getByRole("heading", { name: "Codebase rating" })
    ).toBeVisible();
    await expect(page.locator("#code-rating-prompt")).toBeVisible();
    await expect(
      page.locator(".code-page-rating").getByRole("button", { name: "Copy" }).first()
    ).toBeVisible();
  });
});

