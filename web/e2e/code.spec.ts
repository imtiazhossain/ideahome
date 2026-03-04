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
    await page.route("**/projects", async (route) => {
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

  async function expandSecuritySection(page: import("@playwright/test").Page) {
    const runButton = page.locator(".code-page-run-btn");
    if ((await runButton.count()) > 0) return;
    const securityToggle = page.getByRole("button", { name: "Security" });
    await expect(securityToggle).toBeVisible();
    await securityToggle.click();
    await expect(runButton).toBeVisible();
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
      ).toHaveText("8.6/10");
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

  test("shows readable error when security audit returns HTML", async ({
    page,
  }) => {
    await seedAuth(page);
    await mockProjectsApi(page);
    await page.route("**/api/run-security-audit?**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "text/html",
        body: "<!DOCTYPE html><html><body><h1>Server exploded</h1></body></html>",
      });
    });

    await page.goto("/code", { waitUntil: "networkidle" });
    await expandSecuritySection(page);
    const runSecurityAuditButton = page.getByRole("button", {
      name: "Run security audit",
    });
    await page.waitForTimeout(150);
    await runSecurityAuditButton.click();

    const securitySection = page.locator(".code-page-security-section");
    await expect(
      securitySection.locator(".code-page-error-inline").last()
    ).toContainText(
      "Security audit request failed (500 Internal Server Error): Server exploded"
    );
  });

  test("does not show generic error when security audit returns data on 200", async ({
    page,
  }) => {
    await seedAuth(page);
    await mockProjectsApi(page);
    await page.route("**/api/run-security-audit?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          generatedAt: new Date().toISOString(),
          durationMs: 120,
          score: 10,
          summary: {
            critical: 0,
            high: 0,
            moderate: 0,
            low: 0,
            totalDependencies: 42,
          },
          findings: [],
        }),
      });
    });

    await page.goto("/code", { waitUntil: "networkidle" });
    await expandSecuritySection(page);
    const runSecurityAuditButton = page.getByRole("button", {
      name: "Run security audit",
    });
    await page.waitForTimeout(150);
    await runSecurityAuditButton.click();

    const securitySection = page.locator(".code-page-security-section");
    await expect(
      securitySection.locator(".code-page-rating-score-value").first()
    ).toContainText("10.0/10");
    await expect(
      securitySection.getByText("Security audit failed (200)")
    ).toHaveCount(0);
  });
});
