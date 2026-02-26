import { createProject, fetchProjects, type Project } from "./api";

const DEFAULT_PROJECTS = ["Work", "Life"] as const;

function getMissingDefaults(projects: Project[]): string[] {
  const existing = new Set(projects.map((p) => p.name.trim().toLowerCase()));
  return DEFAULT_PROJECTS.filter((name) => !existing.has(name.toLowerCase()));
}

export async function ensureDefaultProjects(
  initialProjects: Project[]
): Promise<Project[]> {
  const missing = getMissingDefaults(initialProjects);
  if (missing.length === 0) return initialProjects;
  for (const name of missing) {
    try {
      await createProject({ name });
    } catch {
      // Ignore duplicate/conflict/race errors; we'll refetch below.
    }
  }
  try {
    return await fetchProjects();
  } catch {
    return initialProjects;
  }
}
