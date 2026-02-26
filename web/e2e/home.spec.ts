import { test, expect } from "@playwright/test";
import { deleteTestProjectsByNames } from "./helpers";

// Ensure / stays on Board (avoids redirect to first tab like /todo).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("ideahome-explicit-board", "1");
  });
});

// Close the page after each test so the browser can shut down when the run finishes.
test.afterEach(async ({ page }) => {
  await page.close();
});

// Remove projects created by these tests when the suite finishes.
test.afterAll(async () => {
  await deleteTestProjectsByNames([
    "E2E Project",
    "Delete Me Project",
    "Delete Me Persist Project",
  ]);
});

test.describe("Idea Home home", () => {
  test("home page loads with title and app bar", async ({ page }) => {
    await test.step("Navigate to home", async () => {
      await page.goto("/");
    });
    await test.step("Expand sidebar if closed", async () => {
      const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
        await expect(page.locator(".drawer-open")).toBeVisible();
      }
    });
    await test.step("Verify drawer title is Idea Home", async () => {
      await expect(page.locator(".drawer-title")).toHaveText("Idea Home");
    });
    await test.step("Verify Create Deck and New project button are visible", async () => {
      await expect(
        page.locator(".project-nav").getByRole("button", { name: "Create Deck" })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "+ New project" })
      ).toBeVisible();
    });
  });

  test("sidebar shows Idea Home and projects section; nav bar shows Board and Tests", async ({
    page,
  }) => {
    await test.step("Navigate to home", async () => {
      await page.goto("/");
    });
    await test.step("Expand sidebar if closed", async () => {
      const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
        await expect(page.locator(".drawer-open")).toBeVisible();
      }
    });
    await test.step("Verify drawer title and Projects section", async () => {
      await expect(page.locator(".drawer-title")).toHaveText("Idea Home");
      await expect(page.locator(".drawer-nav-label").first()).toHaveText(
        "Projects"
      );
      await expect(
        page.getByRole("button", { name: "All projects" })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "+ New project" })
      ).toBeVisible();
    });
    await test.step("Verify Board and Tests tabs in nav bar", async () => {
      await expect(
        page.locator(".project-nav-tab").filter({ hasText: "Board" })
      ).toBeVisible();
      await expect(
        page.locator(".project-nav-tab").filter({ hasText: "Tests" })
      ).toBeVisible();
    });
  });

  test("board shows status columns when no project selected", async ({
    page,
  }) => {
    await test.step("Navigate to home", async () => {
      await page.goto("/");
    });
    await test.step("Verify status columns: Backlog, To Do, In Progress, Done", async () => {
      await expect(page.locator(".column-backlog .column-title")).toHaveText(
        "Backlog"
      );
      await expect(page.locator(".column-todo .column-title")).toHaveText(
        "To Do"
      );
      await expect(
        page.locator(".column-in_progress .column-title")
      ).toHaveText("In Progress");
      await expect(page.locator(".column-done .column-title")).toHaveText(
        "Done"
      );
    });
  });

  test("drawer toggle collapses and expands sidebar", async ({ page }) => {
    await test.step("Navigate to home", async () => {
      await page.goto("/");
    });
    await test.step("Expand sidebar if closed", async () => {
      const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
    });
    await test.step("Verify sidebar is open", async () => {
      await expect(page.locator(".drawer-open")).toBeVisible();
    });
    await test.step("Click Collapse sidebar", async () => {
      await page.getByRole("button", { name: "Collapse sidebar" }).click();
    });
    await test.step("Verify sidebar is closed", async () => {
      await expect(page.locator(".drawer-closed")).toBeVisible();
    });
    await test.step("Click Expand sidebar", async () => {
      await page.getByRole("button", { name: "Expand sidebar" }).click();
    });
    await test.step("Verify sidebar is open again", async () => {
      await expect(page.locator(".drawer-open")).toBeVisible();
    });
  });

  test("Code Health nav link opens coverage page", async ({ page }) => {
    await test.step("Navigate to home", async () => {
      await page.goto("/");
    });
    await test.step("Click Code Health link in nav bar", async () => {
      await page
        .locator(".project-nav-tab")
        .filter({ hasText: "Code Health" })
        .click();
    });
    await test.step("Verify coverage page URL and title", async () => {
      await expect(page).toHaveURL(/\/coverage/);
      await expect(page.locator(".coverage-page-title")).toHaveText(
        "Code Health"
      );
    });
    await test.step("Verify Back to Idea Home link is visible", async () => {
      await expect(
        page.getByRole("link", { name: /Back to Idea Home/ })
      ).toBeVisible();
    });
  });
});

test.describe("Create project", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
    if (await expandBtn.isVisible()) {
      await expandBtn.click();
    }
  });

  test("opens create project modal and shows form", async ({ page }) => {
    await test.step("Click + New project", async () => {
      await page.getByRole("button", { name: "+ New project" }).click();
    });
    await test.step("Verify Create project modal and form fields", async () => {
      const modal = page
        .locator(".modal")
        .filter({ hasText: "Create project" });
      await expect(modal.locator("h2")).toHaveText("Create project");
      await expect(
        modal.getByPlaceholder("e.g. Engineering, Marketing")
      ).toBeVisible();
      await expect(modal.getByRole("button", { name: "Create" })).toBeVisible();
      await expect(modal.getByRole("button", { name: "Cancel" })).toBeVisible();
    });
  });

  test("create project with new organization", async ({ page }) => {
    await test.step("Click + New project and wait for modal", async () => {
      await page.getByRole("button", { name: "+ New project" }).click();
      await expect(page.locator(".modal h2")).toHaveText("Create project", {
        timeout: 10000,
      });
    });
    await test.step("Fill organization (new or existing)", async () => {
      const modal = page
        .locator(".modal")
        .filter({ hasText: "Create project" });
      const orgInput = modal.getByPlaceholder("My Organization");
      const orgCombobox = modal.getByRole("combobox", { name: "Organization" });
      if (await orgInput.isVisible()) {
        await orgInput.fill("E2E Org");
      } else {
        await orgCombobox.waitFor({ state: "visible", timeout: 15000 });
        await orgCombobox.selectOption({ index: 1 });
      }
    });
    await test.step("Fill project name and click Create", async () => {
      const modal = page
        .locator(".modal")
        .filter({ hasText: "Create project" });
      await modal
        .getByPlaceholder("e.g. Engineering, Marketing")
        .fill("E2E Project");
      await modal.getByRole("button", { name: "Create" }).click();
    });
    await test.step("Verify modal closed and E2E Project selected in sidebar", async () => {
      await expect(page.locator(".modal")).not.toBeVisible();
      await expect(
        page.locator(".drawer-nav-item.is-selected", { hasText: "E2E Project" })
      ).toBeVisible();
    });
  });

  test("validation shows error when project name is empty", async ({
    page,
  }) => {
    await test.step("Open create project modal", async () => {
      await page.getByRole("button", { name: "+ New project" }).click();
    });
    await test.step("Click Create without filling project name", async () => {
      const modal = page
        .locator(".modal")
        .filter({ hasText: "Create project" });
      await modal.getByRole("button", { name: "Create" }).click();
    });
    await test.step("Verify modal stays open and project name field is visible", async () => {
      const modal = page
        .locator(".modal")
        .filter({ hasText: "Create project" });
      await expect(modal).toBeVisible();
      await expect(
        modal.getByPlaceholder("e.g. Engineering, Marketing")
      ).toBeVisible();
    });
  });

  test("cancel closes create project modal", async ({ page }) => {
    await test.step("Open create project modal", async () => {
      await page.getByRole("button", { name: "+ New project" }).click();
    });
    await test.step("Verify modal is visible", async () => {
      const modal = page
        .locator(".modal")
        .filter({ hasText: "Create project" });
      await expect(modal).toBeVisible();
    });
    await test.step("Click Cancel", async () => {
      const modal = page
        .locator(".modal")
        .filter({ hasText: "Create project" });
      await modal.getByRole("button", { name: "Cancel" }).click();
    });
    await test.step("Verify modal is closed", async () => {
      await expect(page.locator(".modal")).not.toBeVisible();
    });
  });
});

test.describe("Board search", () => {
  test("search input is visible and accepts text", async ({ page }) => {
    await test.step("Navigate to home", async () => {
      await page.goto("/");
    });
    await test.step("Verify search input is visible", async () => {
      const search = page.getByRole("searchbox", { name: "Search" });
      await expect(search).toBeVisible();
    });
    await test.step("Type in search box", async () => {
      const search = page.getByRole("searchbox", { name: "Search" });
      await search.fill("backlog");
    });
    await test.step("Verify search has value", async () => {
      const search = page.getByRole("searchbox", { name: "Search" });
      await expect(search).toHaveValue("backlog");
    });
  });
});

test.describe("Create Deck", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page
      .locator(".project-nav")
      .getByRole("button", { name: "Create Deck" })
      .click();
  });

  test("opens create deck modal", async ({ page }) => {
    await test.step("Verify Create Deck modal and form", async () => {
      const createDeckModal = page
        .locator(".modal")
        .filter({ hasText: "Create Deck" });
      await expect(createDeckModal.locator("h2")).toHaveText("Create Deck");
      await expect(createDeckModal.getByPlaceholder("Summary")).toBeVisible();
      await expect(
        createDeckModal.getByRole("button", { name: "Create" })
      ).toBeVisible();
    });
  });

  test("create issue with title only", async ({ page }) => {
    await test.step("Fill Summary and select Project", async () => {
      const createDeckModal = page
        .locator(".modal")
        .filter({ hasText: "Create Deck" });
      await createDeckModal.getByPlaceholder("Summary").fill("E2E test issue");
      const projectSelect = createDeckModal.getByRole("combobox", {
        name: "Project",
      });
      await expect(projectSelect).toBeVisible({ timeout: 15000 });
      await projectSelect.selectOption({ index: 1 });
    });
    await test.step("Click Create", async () => {
      const createDeckModal = page
        .locator(".modal")
        .filter({ hasText: "Create Deck" });
      await createDeckModal.getByRole("button", { name: "Create" }).click();
    });
    await test.step("Verify modal closed and issue card visible", async () => {
      await expect(page.locator(".modal")).not.toBeVisible({ timeout: 5000 });
      await expect(
        page
          .locator(".issue-card-title")
          .filter({ hasText: "E2E test issue" })
          .first()
      ).toBeVisible();
    });
  });

  test("validation shows error when title is empty", async ({ page }) => {
    await test.step("Click Create without filling Summary", async () => {
      const createDeckModal = page
        .locator(".modal")
        .filter({ hasText: "Create Deck" });
      await createDeckModal.getByRole("button", { name: "Create" }).click();
    });
    await test.step("Verify error banner", async () => {
      const createDeckModal = page
        .locator(".modal")
        .filter({ hasText: "Create Deck" });
      await expect(createDeckModal.locator(".error-banner")).toContainText(
        "Please enter a title."
      );
    });
  });

  test("cancel closes create deck modal", async ({ page }) => {
    await test.step("Verify Create Deck modal is visible", async () => {
      const createDeckModal = page
        .locator(".modal")
        .filter({ hasText: "Create Deck" });
      await expect(createDeckModal).toBeVisible();
    });
    await test.step("Click Cancel", async () => {
      const createDeckModal = page
        .locator(".modal")
        .filter({ hasText: "Create Deck" });
      await createDeckModal.getByRole("button", { name: "Cancel" }).click();
    });
    await test.step("Verify modal is closed", async () => {
      await expect(page.locator(".modal")).not.toBeVisible();
    });
  });
});

test.describe("Delete project", () => {
  test("delete button opens confirm modal and cancel closes it", async ({
    page,
  }) => {
    await test.step("Navigate to home and open create project modal", async () => {
      await page.goto("/");
      const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
      await page.getByRole("button", { name: "+ New project" }).click();
      const createModal = page
        .locator(".modal")
        .filter({ hasText: "Create project" });
      await expect(createModal).toBeVisible({ timeout: 5000 });
    });
    await test.step("Fill organization and project name, create project", async () => {
      const createModal = page
        .locator(".modal")
        .filter({ hasText: "Create project" });
      if (await createModal.getByPlaceholder("My Organization").isVisible()) {
        await createModal.getByPlaceholder("My Organization").fill("Del Org");
      } else {
        await createModal
          .getByRole("combobox", { name: "Organization" })
          .selectOption({ index: 1 });
      }
      await createModal
        .getByPlaceholder("e.g. Engineering, Marketing")
        .fill("Delete Me Project");
      await createModal.getByRole("button", { name: "Create" }).click();
      await expect(page.locator(".modal")).not.toBeVisible({ timeout: 10000 });
      await expect(
        page.getByRole("button", { name: "Delete Me Project", exact: true })
      ).toBeVisible({ timeout: 10000 });
    });
    await test.step("Click delete button for Delete Me Project", async () => {
      await page
        .getByRole("button", { name: "Delete Delete Me Project" })
        .click();
    });
    await test.step("Verify Delete project confirm modal", async () => {
      const deleteModal = page
        .locator(".modal")
        .filter({ hasText: "Delete project" });
      await expect(deleteModal).toBeVisible();
      await expect(deleteModal).toContainText("Delete Me Project");
    });
    await test.step("Click Cancel in delete modal", async () => {
      const deleteModal = page
        .locator(".modal")
        .filter({ hasText: "Delete project" });
      await deleteModal.getByRole("button", { name: "Cancel" }).click();
    });
    await test.step("Verify delete modal closed and project still in sidebar", async () => {
      await expect(page.locator(".modal")).not.toBeVisible();
      await expect(
        page.getByRole("button", { name: "Delete Me Project", exact: true })
      ).toBeVisible();
    });
  });

  test("deleting from sidebar removes project and stays deleted after reload", async ({
    page,
  }) => {
    await test.step("Create Delete Me Persist Project", async () => {
      await page.goto("/");
      let createModal = page
        .locator(".modal")
        .filter({ hasText: "Create project" });
      if (!(await createModal.isVisible())) {
        const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
        if (await expandBtn.isVisible()) {
          await expandBtn.click();
        }
        await page.getByRole("button", { name: "+ New project" }).click();
      }
      createModal = page.locator(".modal").filter({ hasText: "Create project" });
      await expect(createModal).toBeVisible({ timeout: 5000 });
      if (await createModal.getByPlaceholder("My Organization").isVisible()) {
        await createModal.getByPlaceholder("My Organization").fill("Del Org");
      } else {
        await createModal
          .getByRole("combobox", { name: "Organization" })
          .selectOption({ index: 1 });
      }
      await createModal
        .getByPlaceholder("e.g. Engineering, Marketing")
        .fill("Delete Me Persist Project");
      await createModal.getByRole("button", { name: "Create" }).click();
      await expect(page.locator(".modal")).not.toBeVisible({ timeout: 10000 });
      await expect(
        page.getByRole("button", {
          name: "Delete Me Persist Project",
          exact: true,
        })
      ).toBeVisible({ timeout: 10000 });
    });

    await test.step("Delete project from sidebar and confirm", async () => {
      await page
        .getByRole("button", { name: "Delete Delete Me Persist Project" })
        .click();
      const deleteModal = page
        .locator(".modal")
        .filter({ hasText: "Delete project" });
      await expect(deleteModal).toBeVisible();
      await deleteModal.getByRole("button", { name: "Delete" }).click();
      await expect(page.locator(".modal")).not.toBeVisible({ timeout: 10000 });
      await expect(
        page.getByRole("button", {
          name: "Delete Me Persist Project",
          exact: true,
        })
      ).toHaveCount(0);
    });

    await test.step("Reload page and verify deleted project does not reappear", async () => {
      await page.reload();
      const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
      await expect(
        page.getByRole("button", {
          name: "Delete Me Persist Project",
          exact: true,
        })
      ).toHaveCount(0);
    });
  });
});

test.describe("Issue detail", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
    if (await expandBtn.isVisible()) {
      await expandBtn.click();
    }
    const newProjectBtn = page.getByRole("button", { name: "+ New project" });
    if (await newProjectBtn.isVisible()) {
      await newProjectBtn.click();
      const createProjectModal = page
        .locator(".modal")
        .filter({ hasText: "Create project" });
      await expect(createProjectModal).toBeVisible({ timeout: 10000 });
      if (
        await createProjectModal.getByPlaceholder("My Organization").isVisible()
      ) {
        await createProjectModal
          .getByPlaceholder("My Organization")
          .fill("E2E Org");
      } else {
        await createProjectModal
          .getByRole("combobox", { name: "Organization" })
          .selectOption({ index: 1 });
      }
      await createProjectModal
        .getByPlaceholder("e.g. Engineering, Marketing")
        .fill("E2E Project");
      await createProjectModal.getByRole("button", { name: "Create" }).click();
      await expect(page.locator(".modal")).not.toBeVisible({ timeout: 10000 });
      await page
        .getByRole("button", { name: "E2E Project", exact: true })
        .click();
    } else {
      const firstProject = page
        .locator(".drawer-nav-item-row")
        .locator("button.drawer-nav-item")
        .first();
      if (await firstProject.isVisible()) {
        await firstProject.click();
      }
    }
    const addBtn = page
      .locator(".project-nav")
      .getByRole("button", { name: "Create Deck" });
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();
    const createDeckModal = page
      .locator(".modal")
      .filter({ hasText: "Create Deck" });
    await expect(createDeckModal).toBeVisible({ timeout: 10000 });
    await createDeckModal.getByPlaceholder("Summary").fill("Issue to open");
    const projectSelect = createDeckModal.getByRole("combobox", {
      name: "Project",
    });
    await expect(projectSelect).toBeVisible({ timeout: 15000 });
    await projectSelect.selectOption({ index: 1 });
    await createDeckModal.getByRole("button", { name: "Create" }).click();
    await expect(page.locator(".modal")).not.toBeVisible({ timeout: 5000 });
  });

  test("clicking issue card opens detail modal", async ({ page }) => {
    await test.step("Click issue card Issue to open", async () => {
      await page
        .locator(".issue-card-title")
        .filter({ hasText: "Issue to open" })
        .first()
        .click();
    });
    await test.step("Verify detail modal content and Close button", async () => {
      const detailModal = page
        .locator(".modal")
        .filter({ hasText: "Issue to open" });
      await expect(detailModal.locator("h2")).toContainText("-");
      await expect(detailModal).toContainText("Issue to open");
      await expect(
        detailModal.getByRole("button", { name: "Close" })
      ).toBeVisible();
    });
  });

  test("close button dismisses detail modal", async ({ page }) => {
    await test.step("Click issue card to open detail modal", async () => {
      await page
        .locator(".issue-card-title")
        .filter({ hasText: "Issue to open" })
        .first()
        .click();
    });
    await test.step("Verify detail modal is visible", async () => {
      const detailModal = page
        .locator(".modal")
        .filter({ hasText: "Issue to open" });
      await expect(detailModal).toBeVisible();
    });
    await test.step("Click Close", async () => {
      const detailModal = page
        .locator(".modal")
        .filter({ hasText: "Issue to open" });
      await detailModal.getByRole("button", { name: "Close" }).click();
    });
    await test.step("Verify modal is closed", async () => {
      await expect(page.locator(".modal")).not.toBeVisible();
    });
  });

  test("automated tests multi-select shows options and saves selection", async ({
    page,
  }) => {
    await test.step("Open issue detail modal", async () => {
      await page
        .locator(".issue-card-title")
        .filter({ hasText: "Issue to open" })
        .first()
        .click();
      const detailModal = page
        .locator(".modal")
        .filter({ hasText: "Issue to open" });
      await expect(detailModal).toBeVisible();
    });
    await test.step("Open Automated Tests dropdown and verify options", async () => {
      const detailModal = page
        .locator(".modal")
        .filter({ hasText: "Issue to open" });
      await expect(
        detailModal.locator("label").filter({ hasText: "Automated Tests" })
      ).toBeVisible();
      await detailModal.locator(".automated-tests-trigger").click();
      await expect(
        detailModal.locator(".automated-tests-dropdown")
      ).toBeVisible();
      await expect(
        detailModal.locator(".automated-tests-suite-header").first()
      ).toBeVisible();
    });
    await test.step("Select test option and verify chip", async () => {
      const detailModal = page
        .locator(".modal")
        .filter({ hasText: "Issue to open" });
      await detailModal
        .locator(".automated-tests-option")
        .filter({ hasText: "home page loads with title and app bar" })
        .click();
      await expect(detailModal.locator(".automated-tests-chip")).toHaveCount(1);
      await expect(
        detailModal.locator(".automated-tests-chip-text").first()
      ).toHaveText("home page loads with title and app bar");
    });
    await test.step("Click Save and verify success", async () => {
      const detailModal = page
        .locator(".modal")
        .filter({ hasText: "Issue to open" });
      await expect(
        detailModal.getByRole("button", { name: "Save" })
      ).toBeVisible();
      await detailModal.getByRole("button", { name: "Save" }).click();
      await expect(detailModal.getByText("Saved successfully")).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test("automated tests chip can be removed", async ({ page }) => {
    await test.step("Open issue detail and add automated test chip", async () => {
      await page
        .locator(".issue-card-title")
        .filter({ hasText: "Issue to open" })
        .first()
        .click();
      const detailModal = page
        .locator(".modal")
        .filter({ hasText: "Issue to open" });
      await expect(detailModal).toBeVisible();
      await detailModal.locator(".automated-tests-trigger").click();
      await detailModal
        .locator(".automated-tests-option")
        .filter({ hasText: "home page loads with title and app bar" })
        .click();
      await expect(detailModal.locator(".automated-tests-chip")).toHaveCount(1);
    });
    await test.step("Remove chip and verify count is 0", async () => {
      const detailModal = page
        .locator(".modal")
        .filter({ hasText: "Issue to open" });
      await detailModal.locator(".automated-tests-chip-remove").first().click();
      await expect(detailModal.locator(".automated-tests-chip")).toHaveCount(0);
    });
  });

  test("editing title and saving shows success", async ({ page }) => {
    await test.step("Open issue detail modal", async () => {
      await page
        .locator(".issue-card-title")
        .filter({ hasText: "Issue to open" })
        .first()
        .click();
      const detailModal = page
        .locator(".modal")
        .filter({ hasText: "Issue to open" });
      await expect(detailModal).toBeVisible();
    });
    await test.step("Edit Summary and click Save", async () => {
      const detailModal = page
        .locator(".modal")
        .filter({ hasText: "Issue to open" });
      await detailModal
        .getByPlaceholder("Summary")
        .fill("Issue to open (updated)");
      await expect(
        detailModal.getByRole("button", { name: "Save" })
      ).toBeVisible();
      await detailModal.getByRole("button", { name: "Save" }).click();
    });
    await test.step("Verify Saved successfully and updated value", async () => {
      const detailModal = page
        .locator(".modal")
        .filter({ hasText: "Issue to open" });
      await expect(detailModal.getByText("Saved successfully")).toBeVisible({
        timeout: 5000,
      });
      await expect(detailModal.getByPlaceholder("Summary")).toHaveValue(
        "Issue to open (updated)"
      );
    });
  });

  test("issue card status dropdown changes status", async ({ page }) => {
    await test.step("Verify issue card visible and change status to In Progress", async () => {
      const card = page
        .locator(".issue-card")
        .filter({ hasText: "Issue to open" })
        .first();
      await expect(card).toBeVisible();
      await card.locator(".dropdown-status").selectOption("in_progress");
    });
    await test.step("Verify issue appears in In Progress column", async () => {
      await expect(
        page
          .locator(".column-in_progress")
          .locator(".issue-card-title")
          .filter({ hasText: "Issue to open" })
      ).toBeVisible();
    });
  });
});

test.describe("Run automated test", () => {
  test("nav Tests link opens tests page and run test modal", async ({
    page,
  }) => {
    await test.step("Navigate to home and click Tests link", async () => {
      await page.goto("/");
      const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
      }
      await page
        .locator("aside.drawer")
        .getByRole("link", { name: "Tests" })
        .click();
      await expect(page).toHaveURL(/\/tests/);
    });
    await test.step("Click test name to open run test modal", async () => {
      await page
        .locator(".automated-test-name-btn")
        .filter({ hasText: "home page loads with title and app bar" })
        .click();
    });
    await test.step("Verify Run automated test modal content", async () => {
      const runTestModal = page
        .locator(".modal")
        .filter({ hasText: "Run automated test" });
      await expect(runTestModal.locator("h2")).toHaveText("Run automated test");
      await expect(runTestModal).toContainText("Idea Home home");
      await expect(runTestModal).toContainText(
        "home page loads with title and app bar"
      );
      await expect(runTestModal.locator("button.btn-secondary")).toBeVisible();
      await expect(
        runTestModal.getByRole("button", { name: "Copy run command" })
      ).toBeVisible();
      await expect(
        runTestModal.getByRole("button", { name: "Run with live view" })
      ).toBeVisible();
    });
  });

  test("run test modal can be closed", async ({ page }) => {
    await test.step("Navigate to tests page", async () => {
      await page.goto("/tests");
    });
    await test.step("Open run test modal", async () => {
      await page
        .locator(".automated-test-name-btn")
        .filter({ hasText: "home page loads with title and app bar" })
        .click();
      const runTestModal = page
        .locator(".modal")
        .filter({ hasText: "Run automated test" });
      await expect(runTestModal.locator("h2")).toHaveText("Run automated test");
    });
    await test.step("Click Close and verify modal closed", async () => {
      const runTestModal = page
        .locator(".modal")
        .filter({ hasText: "Run automated test" });
      await runTestModal.locator("button.btn-secondary").click();
      await expect(page.locator(".modal")).not.toBeVisible();
    });
  });
});
