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
  await page.route("**/expenses*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
  await page.route("**/plaid/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

test.describe("Finances page", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthAndMocks(page);
  });

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

  test("shows empty-state copy when project has no expenses", async ({
    page,
  }) => {
    await test.step("Navigate to Finances page", async () => {
      await page.goto("/finances");
    });
    await test.step("Verify empty-state message", async () => {
      const content = page.locator(".expenses-page-content");
      await expect(
        content.getByText("It's dark in here...", {
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

  test("reordered finance sections hydrate cleanly and still minimize", async ({
    page,
  }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (
        /hydration|did not match|server-rendered HTML|Hydration failed/i.test(
          text
        )
      ) {
        hydrationErrors.push(text);
      }
    });

    await page.goto("/finances");
    await expect(
      page.getByRole("heading", { name: /Summary/ })
    ).toBeVisible();

    await page.evaluate(() => {
      const reordered = JSON.stringify([
        "expenses-add-and-list",
        "expenses-summary",
        "expenses-auth-notice",
        "expenses-plaid",
        "expenses-taxes",
      ]);
      localStorage.setItem("ideahome-finances-section-order", reordered);
      localStorage.setItem("ideahome-finances-section-order-proj-e2e", reordered);
    });

    await page.reload();
    await expect(
      page.locator(".expenses-add-section .tests-page-section-title")
    ).toHaveText(/Expenses/);
    await expect(hydrationErrors).toEqual([]);

    const expensesSection = page.locator(".expenses-add-section");
    await expensesSection
      .getByRole("button", { name: "Expand Section Height" })
      .click();
    await expect(expensesSection).toHaveAttribute("data-full-height", "true");

    await expensesSection
      .getByRole("button", { name: "Minimize Section Height" })
      .click();
    await expect(expensesSection).toHaveAttribute("data-full-height", "false");
  });

});
