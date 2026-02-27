import { test, expect } from "@playwright/test";
import { expectHomeUrl, expandSidebarIfNeeded } from "./helpers";

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("Code Coverage page", () => {
  test("coverage page has title, back link, and Run coverage button", async ({
    page,
  }) => {
    await test.step("Navigate to coverage page", async () => {
      await page.goto("/coverage");
    });
    await test.step("Verify title, back link, and Run coverage button", async () => {
      await expect(page.locator(".coverage-page-title")).toHaveText(
        "Code Health"
      );
      await expect(
        page.getByRole("link", { name: /Back to Idea Home/ })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Run coverage" })
      ).toBeVisible();
    });
  });

  test("Back to Idea Home returns to home", async ({ page }) => {
    await test.step("Navigate to coverage page", async () => {
      await page.goto("/coverage");
    });
    await test.step("Click Back to Idea Home", async () => {
      await page.getByRole("link", { name: /Back to Idea Home/ }).click();
    });
    await test.step("Verify home URL and Idea Home title", async () => {
      await expectHomeUrl(page);
      await expandSidebarIfNeeded(page);
      await expect(page.locator(".drawer-title")).toHaveText("Idea Home", {
        timeout: 5000,
      });
    });
  });

  test("Run coverage button is clickable", async ({ page }) => {
    await test.step("Navigate to coverage page", async () => {
      await page.goto("/coverage");
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
