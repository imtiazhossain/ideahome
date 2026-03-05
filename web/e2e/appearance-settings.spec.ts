import { expect, test } from "@playwright/test";
import { ensureProjectExists, expandSidebarIfNeeded } from "./helpers";

test.beforeAll(async () => {
  await ensureProjectExists();
});

test.afterEach(async ({ page }) => {
  await page.close();
});

test.describe("Appearance settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("ideahome_token", "e2e-token");
      sessionStorage.setItem("ideahome_token_session", "e2e-token");
      document.cookie = "ideahome_token=e2e-token; Path=/; SameSite=Lax";
    });
  });

  test("opens settings from drawer menu", async ({ page }) => {
    await page.goto("/");
    await expandSidebarIfNeeded(page);

    const drawer = page.locator(".drawer-open");
    await drawer.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("menuitem", { name: "Open appearance settings" }).click();

    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: "Appearance settings" })).toBeVisible();
  });

  test("preview/cancel/save and persist per mode", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Appearance settings" })).toBeVisible();

    const initialLightScheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-color-scheme")
    );

    await page.getByRole("button", { name: "Light mode" }).click();
    await page.getByRole("button", { name: "Ocean (light)" }).click();

    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.getAttribute("data-color-scheme"))
      )
      .toBe("ocean");

    await page.getByRole("button", { name: "Cancel" }).click();

    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.getAttribute("data-color-scheme"))
      )
      .toBe(initialLightScheme);

    await page.getByRole("button", { name: "Ocean (light)" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Appearance saved.")).toBeVisible();

    await page.getByRole("button", { name: "Dark mode" }).click();
    await page.getByRole("button", { name: "Forest (dark)" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Appearance saved.")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Light mode" }).click();
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.getAttribute("data-color-scheme"))
      )
      .toBe("ocean");

    await page.getByRole("button", { name: "Dark mode" }).click();
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.getAttribute("data-color-scheme"))
      )
      .toBe("forest");
  });

  test("failed save applies locally and shows retry notice", async ({ page }) => {
    await page.route("**/users/me/appearance", async (route, request) => {
      if (request.method() === "PUT") {
        await route.fulfill({ status: 500, body: JSON.stringify({ message: "boom" }) });
        return;
      }
      await route.continue();
    });

    await page.goto("/settings");
    await page.getByRole("button", { name: "Light mode" }).click();
    await page.getByRole("button", { name: "Forest (light)" }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByText("Saved locally. Sync will retry automatically.")
    ).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.getAttribute("data-color-scheme"))
      )
      .toBe("forest");

    await page.reload();
    await page.getByRole("button", { name: "Light mode" }).click();
    await expect
      .poll(async () =>
        page.evaluate(() => document.documentElement.getAttribute("data-color-scheme"))
      )
      .toBe("forest");
  });
});
