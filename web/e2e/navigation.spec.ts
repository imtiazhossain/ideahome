import { test, expect } from "@playwright/test";
import {
  deleteTestProjectsByNames,
  dismissCreateProjectModalIfPresent,
  expectHomeUrl,
  expandSidebarIfNeeded,
} from "./helpers";

test.afterEach(async ({ page }) => {
  await page.close();
});

test.afterAll(async () => {
  await deleteTestProjectsByNames(["Nav Project", "Inline Nav Project"]);
});

test.describe("Navigation", () => {
  test("Dashboard link in sidebar goes to home", async ({ page }) => {
    await test.step("Navigate to tests page", async () => {
      await page.goto("/tests");
      await expect(page).toHaveURL(/\/tests/);
    });
    await test.step("Expand sidebar and click Dashboard link", async () => {
      await expandSidebarIfNeeded(page);
      await page.getByRole("link", { name: "Dashboard" }).click();
    });
    await test.step("Verify home URL and Idea Home title", async () => {
      await expectHomeUrl(page);
      await expandSidebarIfNeeded(page);
      await expect(page.locator(".drawer-title")).toHaveText("Idea Home");
    });
  });

  test("Board tab in nav goes to home", async ({ page }) => {
    await test.step("Navigate to tests page", async () => {
      await page.goto("/tests");
    });
    await test.step("Click Board tab", async () => {
      await dismissCreateProjectModalIfPresent(page);
      await page
        .locator(".project-nav-tab")
        .filter({ hasText: "Board" })
        .click();
    });
    await test.step("Verify home URL and Backlog column", async () => {
      await expectHomeUrl(page);
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
      await expandSidebarIfNeeded(page);
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
      await expandSidebarIfNeeded(page);
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
      await expandSidebarIfNeeded(page);
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

  test("inline sidebar create on non-home page shows new project immediately", async ({
    page,
  }) => {
    await test.step("Navigate to tests page", async () => {
      await page.goto("/tests");
      await expect(page).toHaveURL(/\/tests/);
    });
    await test.step("Expand sidebar if closed", async () => {
      await expandSidebarIfNeeded(page);
    });
    await test.step("Create project from sidebar inline input", async () => {
      await page.getByRole("button", { name: "Add project" }).click();
      const input = page.getByRole("textbox", { name: "Project Name" });
      await expect(input).toBeVisible();
      await input.fill("Inline Nav Project");
      await input.press("Enter");
    });
    await test.step("Verify new project appears selected immediately", async () => {
      await expect(
        page.getByRole("button", { name: "Inline Nav Project", exact: true })
      ).toBeVisible({ timeout: 10000 });
      await expect(
        page.locator(".drawer-nav-item.is-selected", {
          hasText: "Inline Nav Project",
        })
      ).toBeVisible({ timeout: 10000 });
      await expect(page.locator(".project-nav-project-name")).toHaveText(
        "Inline Nav Project"
      );
    });
  });
});
