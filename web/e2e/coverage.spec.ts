import { test, expect } from "@playwright/test";

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("Code Health section (on Code page)", () => {
  test("Code page has Code Health section with title and Run coverage button", async ({
    page,
  }) => {
    await test.step("Navigate to Code page", async () => {
      await page.goto("/code");
    });
    await test.step("Verify Code Health section and Run coverage button", async () => {
      await expect(
        page.getByRole("heading", { name: "Code Health", level: 2 })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Run coverage" })
      ).toBeVisible();
    });
  });

  test("Run coverage button is clickable", async ({ page }) => {
    await test.step("Navigate to Code page", async () => {
      await page.goto("/code");
    });
    await test.step("Click Run coverage", async () => {
      await page.getByRole("button", { name: "Run coverage" }).click();
    });
    await test.step("Verify Running… button visible", async () => {
      await expect(
        page.getByRole("button", { name: "Running…" })
      ).toBeVisible();
    });
  });
});

test.describe("Legacy /coverage URL", () => {
  test("/coverage redirects to /code", async ({ page }) => {
    await page.goto("/coverage");
    await expect(page).toHaveURL(/\/code/);
  });
});
