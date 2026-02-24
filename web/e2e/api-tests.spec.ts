import { test, expect } from "@playwright/test";

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("API Tests page", () => {
  test("API Tests page loads with title and back link", async ({ page }) => {
    await test.step("Navigate to API Tests page", async () => {
      await page.goto("/api-tests");
    });
    await test.step("Verify title and Back to Idea Home link", async () => {
      await expect(page.locator(".api-tests-page-title")).toHaveText(
        "API Tests"
      );
      await expect(
        page.getByRole("link", { name: "Back to Idea Home" })
      ).toBeVisible();
    });
  });

  test("Back to Idea Home returns to home", async ({ page }) => {
    await test.step("Navigate to API Tests page", async () => {
      await page.goto("/api-tests");
    });
    await test.step("Click Back to Idea Home", async () => {
      await page.getByRole("link", { name: "Back to Idea Home" }).click();
    });
    await test.step("Verify home URL and Idea Home title", async () => {
      await expect(page).toHaveURL("/");
      const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
      await expect(page.locator(".drawer-title")).toHaveText("Idea Home", {
        timeout: 5000,
      });
    });
  });

  test("page shows test suites and test names", async ({ page }) => {
    await test.step("Navigate to API Tests page", async () => {
      await page.goto("/api-tests");
    });
    await test.step("Verify test suite and test names visible", async () => {
      await expect(page.locator(".api-tests-page-suite").first()).toBeVisible();
      await expect(page.getByText("GET / returns health status")).toBeVisible();
      await expect(page.getByText("GET /projects returns list")).toBeVisible();
    });
  });

  test("run button for a test is visible and clickable", async ({ page }) => {
    await test.step("Navigate to API Tests page", async () => {
      await page.goto("/api-tests");
    });
    await test.step("Click Run this test", async () => {
      const runBtn = page.getByTitle("Run this test").first();
      await expect(runBtn).toBeVisible();
      await runBtn.click();
    });
    await test.step("Verify result or Running… visible", async () => {
      await expect(
        page.locator(".api-tests-page-result").or(page.getByText("Running…"))
      ).toBeVisible({ timeout: 20000 });
    });
  });
});

test.describe("Tests page", () => {
  test("Tests page shows Test Cases, API Tests, and Automated Tests sections", async ({
    page,
  }) => {
    await test.step("Navigate to Tests page", async () => {
      await page.goto("/tests");
    });
    await test.step("Verify page title and section headings", async () => {
      const content = page.locator(".tests-page-content");
      await expect(content.locator(".tests-page-title")).toHaveText("Tests");
      await expect(
        content.getByRole("heading", { name: /Test Cases/ })
      ).toBeVisible();
      await expect(
        content.getByRole("heading", { name: /API Tests/ })
      ).toBeVisible();
      await expect(
        content.getByRole("heading", { name: /Automated Tests \(UI\)/ })
      ).toBeVisible();
      await expect(
        content.getByRole("link", { name: "Open API Tests →" })
      ).toBeVisible();
    });
  });

  test("Open API Tests link from Tests page goes to API tests", async ({
    page,
  }) => {
    await test.step("Navigate to Tests page", async () => {
      await page.goto("/tests");
      await expect(page.locator(".tests-page-title")).toHaveText("Tests");
    });
    await test.step("Click Open API Tests →", async () => {
      await page.getByRole("link", { name: "Open API Tests →" }).click();
    });
    await test.step("Verify API Tests page URL and title", async () => {
      await expect(page).toHaveURL(/\/api-tests/);
      await expect(page.locator(".api-tests-page-title")).toHaveText(
        "API Tests"
      );
    });
  });
});
