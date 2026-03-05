import { test, expect } from "@playwright/test";
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
  await page.route("**/api/run-coverage", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        output: "Coverage generated",
        reportCopied: true,
      }),
    });
  });
}

test.describe("Code Health section (on Code page)", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthAndMocks(page);
  });

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
    await test.step("Verify coverage output appears", async () => {
      await expect(page.getByText("Coverage output")).toBeVisible();
    });
  });
});

test.describe("Legacy /coverage URL", () => {
  test("/coverage redirects to /code", async ({ page }) => {
    await page.goto("/coverage");
    await expect(page).toHaveURL(/\/code/);
  });
});
