import { expect, test } from "@playwright/test";
import { ensureProjectExists } from "./helpers";

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

    const project = { id: "e2e-project-1", name: "E2E Project" };
    let appearancePrefs = {
      lightPreset: "classic",
      darkPreset: "classic",
    };
    await page.route("**/projects*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([project]),
        });
        return;
      }
      await route.continue();
    });

    await page.route("**/users/me/appearance", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(appearancePrefs),
        });
        return;
      }
      if (method === "PUT") {
        const raw = route.request().postData() ?? "{}";
        const payload = JSON.parse(raw) as {
          lightPreset?: string;
          darkPreset?: string;
        };
        appearancePrefs = {
          lightPreset: payload.lightPreset ?? appearancePrefs.lightPreset,
          darkPreset: payload.darkPreset ?? appearancePrefs.darkPreset,
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(appearancePrefs),
        });
        return;
      }
      await route.continue();
    });
  });

  test("opens settings page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);
    await expect(
      page.getByRole("heading", { name: "Appearance settings" })
    ).toBeVisible();
  });

  test("preview/cancel/save and persist per mode", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Appearance settings" })
    ).toBeVisible();
    const saveButton = page.locator(".settings-actions .ui-btn--primary");

    const initialLightScheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-color-scheme")
    );

    await page.getByRole("button", { name: "Light mode" }).click();
    await page.getByRole("button", { name: "Ocean (light)" }).click();

    await expect
      .poll(async () =>
        page.evaluate(() =>
          document.documentElement.getAttribute("data-color-scheme")
        )
      )
      .toBe("ocean");

    await page.getByRole("button", { name: "Cancel" }).click();

    await expect
      .poll(async () =>
        page.evaluate(() =>
          document.documentElement.getAttribute("data-color-scheme")
        )
      )
      .toBe(initialLightScheme);

    await page.getByRole("button", { name: "Ocean (light)" }).click();
    await expect(saveButton).toBeEnabled();
    await saveButton.click({ force: true });

    await page.reload();
    await page.getByRole("button", { name: "Light mode" }).click();
    await expect
      .poll(async () =>
        page.evaluate(() =>
          document.documentElement.getAttribute("data-color-scheme")
        )
      )
      .toBe("ocean");
  });

  test("failed save applies locally and shows retry notice", async ({
    page,
  }) => {
    await page.unroute("**/users/me/appearance");
    await page.route("**/users/me/appearance", async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            lightPreset: "classic",
            darkPreset: "classic",
          }),
        });
        return;
      }
      await route.continue();
    });
    await page.route("**/users/me/appearance", async (route, request) => {
      if (request.method() === "PUT") {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ message: "boom" }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/settings");
    await page.getByRole("button", { name: "Light mode" }).click();
    await page.getByRole("button", { name: "Forest (light)" }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(async () =>
        page.evaluate(() =>
          document.documentElement.getAttribute("data-color-scheme")
        )
      )
      .toBe("forest");

    await page.reload();
    await page.getByRole("button", { name: "Light mode" }).click();
    await expect
      .poll(async () =>
        page.evaluate(() =>
          document.documentElement.getAttribute("data-color-scheme")
        )
      )
      .toBe("forest");
  });

  test("manages navigation visibility and Bulby from the settings page", async ({
    page,
  }) => {
    await page.goto("/settings");

    await expect(
      page.getByRole("heading", { name: "Navigation" })
    ).toBeVisible();
    const todoRow = page.locator(".settings-list-row-toggle", {
      hasText: "To-Do",
    });
    const todoCheckbox = todoRow.locator('input[type="checkbox"]');
    await expect(todoCheckbox).toBeChecked();
    await todoCheckbox.click();
    await expect(todoCheckbox).not.toBeChecked();

    const hideBulbyButton = page.getByRole("button", {
      name: "Hide Bulby chat",
    });
    await hideBulbyButton.click();
    await expect(
      page.getByRole("button", { name: "Show Bulby chat" })
    ).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() =>
          window.localStorage.getItem("bulby-chatbox-trigger-hidden")
        )
      )
      .toBe("1");
  });
});
