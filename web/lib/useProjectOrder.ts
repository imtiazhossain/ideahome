import React from "react";
import {
  safeLocalStorageGetJson,
  safeLocalStorageSetJson,
} from "./storage";
import { getUserScopedStorageKey } from "./api/auth";

const PROJECT_ORDER_STORAGE_PREFIX = "ideahome-drawer-project-order";
const PROJECT_ORDER_LEGACY_KEY = "ideahome-drawer-project-order";

function getProjectOrderStorageKey(): string {
  return getUserScopedStorageKey(
    PROJECT_ORDER_STORAGE_PREFIX,
    PROJECT_ORDER_LEGACY_KEY
  );
}

function mergeProjectOrder(
  projects: { id: string; name: string }[],
  orderIds: string[]
): string[] {
  const validIds = new Set(projects.map((p) => p.id));
  const deduped = orderIds.filter(
    (id, idx) => validIds.has(id) && orderIds.indexOf(id) === idx
  );
  const missing = projects
    .map((p) => p.id)
    .filter((id) => !deduped.includes(id));
  return [...deduped, ...missing];
}

function loadProjectOrderIds(): string[] {
  if (typeof window === "undefined") return [];
  const parsed = safeLocalStorageGetJson<unknown[]>(
    getProjectOrderStorageKey(),
    (value): value is unknown[] => Array.isArray(value)
  );
  if (!parsed) return [];
  return parsed.filter((id): id is string => typeof id === "string");
}

function saveProjectOrderIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  safeLocalStorageSetJson(getProjectOrderStorageKey(), ids);
}

export function useProjectOrder(projects: { id: string; name: string }[]) {
  const [projectOrderIds, setProjectOrderIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    setProjectOrderIds((prev) => {
      const base = prev.length > 0 ? prev : loadProjectOrderIds();
      return mergeProjectOrder(projects, base);
    });
  }, [projects]);

  React.useEffect(() => {
    if (projectOrderIds.length > 0) saveProjectOrderIds(projectOrderIds);
  }, [projectOrderIds]);

  const orderedProjects = React.useMemo(() => {
    if (projectOrderIds.length === 0) return projects;
    const map = new Map(projects.map((p) => [p.id, p]));
    return mergeProjectOrder(projects, projectOrderIds)
      .map((id) => map.get(id))
      .filter((p): p is { id: string; name: string } => Boolean(p));
  }, [projects, projectOrderIds]);

  const moveProject = React.useCallback(
    (projectId: string, direction: "up" | "down") => {
      const ids = orderedProjects.map((p) => p.id);
      const from = ids.indexOf(projectId);
      if (from === -1) return;
      const to = direction === "up" ? from - 1 : from + 1;
      if (to < 0 || to >= ids.length) return;
      const next = [...ids];
      [next[from], next[to]] = [next[to], next[from]];
      setProjectOrderIds(next);
    },
    [orderedProjects]
  );

  return { orderedProjects, moveProject };
}

