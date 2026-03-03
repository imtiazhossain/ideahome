import { expect, type Page } from "@playwright/test";
import {
  pathProjectById,
  pathProjects,
  type Project,
} from "@ideahome/shared";

/**
 * E2E helpers. Use from Node (Playwright), not browser.
 * API base for backend when running e2e (backend must be running on 3001 for full flows).
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type { Project };

/** Fetch all projects from the backend. */
export async function fetchProjects(): Promise<Project[]> {
  const r = await fetch(`${API_BASE}${pathProjects()}`);
  if (!r.ok) return [];
  return r.json();
}

/** Ensure at least one project exists so non-home pages don't redirect to "/". */
export async function ensureProjectExists(name = "E2E Seed Project"): Promise<void> {
  try {
    const projects = await fetchProjects();
    if (projects.length > 0) return;
    await fetch(`${API_BASE}${pathProjects()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch (e) {
    console.warn("e2e setup: could not ensure seed project exists:", e);
  }
}

/** Delete a project by id. No-op if request fails (e.g. backend not running). */
export async function deleteProjectById(id: string): Promise<void> {
  const r = await fetch(`${API_BASE}${pathProjectById(id)}`, { method: "DELETE" });
  if (!r.ok) {
    console.warn(`e2e cleanup: failed to delete project ${id}: ${r.status}`);
  }
}

/**
 * Delete all projects whose names are in the given list.
 * Call in afterAll() so test-created projects are removed when the suite finishes.
 */
export async function deleteTestProjectsByNames(
  names: string[]
): Promise<void> {
  const set = new Set(names);
  try {
    const projects = await fetchProjects();
    for (const p of projects) {
      if (set.has(p.name)) {
        await deleteProjectById(p.id);
      }
    }
  } catch (e) {
    console.warn(
      "e2e cleanup: could not fetch/delete test projects (is backend running?):",
      e
    );
  }
}

/** Home route now lands on /ideas in some flows; accept either. */
export async function expectHomeUrl(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/(?:ideas)?(?:\?.*)?$/);
}

/**
 * On empty workspaces the app can auto-open "Create project" on load.
 * Close it so navigation interactions are not blocked by the overlay.
 */
export async function dismissCreateProjectModalIfPresent(
  page: Page
): Promise<void> {
  const overlay = page.locator(".modal-overlay").first();
  if (!(await overlay.isVisible().catch(() => false))) {
    return;
  }

  const createProjectModal = page
    .locator(".modal")
    .filter({ hasText: "Create project" })
    .first();
  if (await createProjectModal.isVisible().catch(() => false)) {
    const nameInput = createProjectModal.getByPlaceholder(
      "e.g. Engineering, Marketing"
    );
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill(`E2E Seed ${Date.now()}`);
      await createProjectModal
        .getByRole("button", { name: "Create" })
        .click()
        .catch(() => {});
      if (!(await overlay.isVisible().catch(() => false))) {
        return;
      }
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    // Try the most generic close actions first; the app has several modal implementations.
    await page.keyboard.press("Escape").catch(() => {});
    await overlay
      .click({ position: { x: 8, y: 8 }, force: true })
      .catch(() => {});
    await page
      .locator(".modal .modal-close")
      .first()
      .click()
      .catch(() => {});
    await page
      .locator(".modal")
      .getByRole("button", { name: "Cancel" })
      .first()
      .click()
      .catch(() => {});
    if (!(await overlay.isVisible().catch(() => false))) {
      return;
    }
  }

  await expect(overlay).not.toBeVisible({ timeout: 10000 });
}

/** Expand left drawer when currently collapsed. */
export async function expandSidebarIfNeeded(page: Page): Promise<void> {
  await dismissCreateProjectModalIfPresent(page);
  const expandBtn = page.getByRole("button", { name: "Expand sidebar" });
  if (await expandBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await expandBtn.click({ trial: true }).catch(() => {});
    await expandBtn.click({ force: true });
    await expect(page.locator(".drawer-open")).toBeVisible({ timeout: 10000 });
  }
}
