import { expect, test, type Page } from "@playwright/test";

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

  await page.route("**/issues*", async (route) => {
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

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("Home page", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthAndMocks(page);
  });

  test("loads board shell and project nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".project-nav")).toBeVisible();
    await expect(page.locator(".project-nav-project-name")).toContainText(
      "E2E Project"
    );
  });

  test("navigates to code page from nav", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Code" }).click();
    await expect(page).toHaveURL(/\/code/);
    await expect(page.locator(".code-page-title")).toHaveText("Code");
  });
});
