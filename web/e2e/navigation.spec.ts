import { test, expect } from "@playwright/test";
import { deleteTestProjectsByNames } from "./helpers";

test.afterEach(async ({ page }) => {
  await page.close();
});

test.afterAll(async () => {
  await deleteTestProjectsByNames(["Nav Project"]);
});

test.describe("Navigation", () => {
  test("Dashboard link in sidebar goes to home", async ({ page }) => {
    await test.step("Navigate to tests page", async () => {
      await page.goto("/tests");
      await expect(page).toHaveURL(/\/tests/);
    });
    await test.step("Expand sidebar and click Dashboard link", async () => {
      const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
      await page.getByRole("link", { name: "Dashboard" }).click();
    });
    await test.step("Verify home URL and Idea Home title", async () => {
      await expect(page).toHaveURL("/");
      const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
      await expect(page.locator(".drawer-title")).toHaveText("Idea Home");
    });
  });

  test("Board tab in nav goes to home", async ({ page }) => {
    await test.step("Navigate to tests page", async () => {
      await page.goto("/tests");
    });
    await test.step("Click Board tab", async () => {
      await page
        .locator(".project-nav-tab")
        .filter({ hasText: "Board" })
        .click();
    });
    await test.step("Verify home URL and Backlog column", async () => {
      await expect(page).toHaveURL("/");
      await expect(page.locator(".column-backlog .column-title")).toHaveText(
        "Backlog"
      );
    });
  });

  test("Tests link in nav goes to tests page", async ({ page }) => {
    await test.step("Navigate to home", async () => {
      await page.goto("/");
    });
    await test.step("Expand sidebar if needed and click Tests link", async () => {
      const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
      await page.getByRole("link", { name: "Tests" }).click();
    });
    await test.step("Verify tests page URL and title", async () => {
      await expect(page).toHaveURL(/\/tests/);
      await expect(page.locator(".tests-page-title")).toHaveText("Tests");
    });
  });

  test("All projects shows board without project filter", async ({ page }) => {
    await test.step("Navigate to home", async () => {
      await page.goto("/");
    });
    await test.step("Expand sidebar and click All projects", async () => {
      const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
      await page.getByRole("button", { name: "All projects" }).click();
    });
    await test.step("Verify Select a project and backlog column", async () => {
      await expect(page.locator(".project-nav-project-name")).toContainText(
        "Select a project"
      );
      await expect(page.locator(".column-backlog")).toBeVisible();
    });
  });

  test("selecting a project in sidebar shows its name in nav", async ({
    page,
  }) => {
    await test.step("Navigate to home", async () => {
      await page.goto("/");
    });
    await test.step("Expand sidebar if closed", async () => {
      const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
    });
    await test.step("Create Nav Project if needed", async () => {
      const newProjectBtn = page.getByRole("button", { name: "+ New project" });
      if (await newProjectBtn.isVisible()) {
        await newProjectBtn.click();
        const modal = page
          .locator(".modal")
          .filter({ hasText: "Create project" });
        await expect(modal).toBeVisible({ timeout: 10000 });
        if (await modal.getByPlaceholder("My Organization").isVisible()) {
          await modal.getByPlaceholder("My Organization").fill("Nav Org");
        } else {
          await modal
            .getByRole("combobox", { name: "Organization" })
            .selectOption({ index: 1 });
        }
        await modal
          .getByPlaceholder("e.g. Engineering, Marketing")
          .fill("Nav Project");
        await modal.getByRole("button", { name: "Create" }).click();
        await expect(page.locator(".modal")).not.toBeVisible({
          timeout: 10000,
        });
      }
    });
    await test.step("Click Nav Project in sidebar", async () => {
      await page
        .getByRole("button", { name: "Nav Project", exact: true })
        .click();
    });
    await test.step("Verify project name in nav bar", async () => {
      await expect(page.locator(".project-nav-project-name")).toHaveText(
        "Nav Project"
      );
    });
  });
});
