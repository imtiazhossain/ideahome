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
      body: JSON.stringify([{ id: "project-e2e", name: "E2E Mock Project" }]),
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

test.describe("Project settings", () => {
  test("project title button is available and clickable", async ({ page }) => {
    await seedAuthAndMocks(page);
    await page.goto("/");

    const openSettingsButton = page.getByRole("button", {
      name: "Open project settings",
    });
    await expect(openSettingsButton).toBeVisible();
    await openSettingsButton.click();

    await expect(page.locator(".project-nav-project-name")).toContainText(
      "E2E Mock Project"
    );
  });
});
