/**
 * E2E helpers. Use from Node (Playwright), not browser.
 * API base for backend when running e2e (backend must be running on 3001 for full flows).
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type Project = { id: string; name: string };

/** Fetch all projects from the backend. */
export async function fetchProjects(): Promise<Project[]> {
  const r = await fetch(`${API_BASE}/projects`);
  if (!r.ok) return [];
  return r.json();
}

/** Delete a project by id. No-op if request fails (e.g. backend not running). */
export async function deleteProjectById(id: string): Promise<void> {
  const r = await fetch(`${API_BASE}/projects/${id}`, { method: "DELETE" });
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
