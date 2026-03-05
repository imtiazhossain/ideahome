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
      body: JSON.stringify([{ id: "proj-e2e", name: "Nav Project" }]),
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

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthAndMocks(page);
    await page.goto("/");
  });

  test("top nav opens Tests page", async ({ page }) => {
    await page.getByTitle("Tests").click();
    await expect(page).toHaveURL(/\/tests/);
    await expect(page.locator(".tests-page-title")).toHaveText("Tests");
  });

  test("top nav opens Calendar page", async ({ page }) => {
    await page.getByTitle("Calendar").click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.locator(".calendar-page-content .tests-page-title")).toHaveText(
      "Calendar"
    );
  });

  test("top nav opens Code page", async ({ page }) => {
    await page.getByTitle("Code").click();
    await expect(page).toHaveURL(/\/code/);
    await expect(page.locator(".code-page-title")).toHaveText("Code");
  });
});
