import { test, expect } from "@playwright/test";

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("Code page", () => {
  async function seedAuth(page: import("@playwright/test").Page) {
    await page.addInitScript(() => {
      localStorage.setItem("ideahome_token", "e2e-token");
      sessionStorage.setItem("ideahome_token_session", "e2e-token");
      document.cookie = "ideahome_token=e2e-token; Path=/; SameSite=Lax";
    });
  }

  async function mockProjectsApi(page: import("@playwright/test").Page) {
    await page.route("**/projects*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "proj-e2e",
            name: "E2E Project",
            order: 0,
            organizationName: null,
            qualityScoreConfig: null,
          },
        ]),
      });
    });
  }

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockProjectsApi(page);
  });

  async function expandSecuritySection(page: import("@playwright/test").Page) {
    const section = page.locator(".code-page-security-section");
    const runButton = section.getByRole("button", { name: "Run security audit" });
    if (await runButton.isVisible().catch(() => false)) return;
    const securityToggle = section.locator(".tests-page-section-toggle-inline");
    await expect(securityToggle).toBeVisible();
    await securityToggle.click();
  }

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
      ).toContainText("/10");
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
      page.getByRole("heading", {
        name: "Suggestions to improve and keep this score high",
      })
    ).toBeVisible();
    await expect(
      page
        .locator(".code-page-rating")
        .getByRole("button", { name: "Copy" })
        .first()
    ).toBeVisible();
  });

  test("shows Release Notes section on Code page", async ({ page }) => {
    await page.goto("/code");
    await expect(
      page.locator(".code-page-release-notes-section .tests-page-section-title")
    ).toHaveText("Release Notes");
    await expect(page.locator(".code-page-release-notes-list")).toBeVisible();
  });

  test("shows Security section and run button", async ({ page }) => {
    await page.goto("/code");
    await expandSecuritySection(page);
    await expect(
      page.locator(".code-page-security-section .tests-page-section-title")
    ).toHaveText("Security");
  });

  test("Security section starts without inline errors", async ({ page }) => {
    await page.goto("/code");
    await expandSecuritySection(page);
    await expect(
      page.locator(".code-page-security-section .code-page-error-inline")
    ).toHaveCount(0);
  });
});
