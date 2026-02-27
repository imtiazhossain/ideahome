import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  createProject,
  deleteProject,
  fetchProjects,
  getUserScopedStorageKey,
  isAuthenticated,
  updateProject,
} from "./api";
import { getProjectDisplayName } from "./utils";
import { useSelectedProject } from "./SelectedProjectContext";
import { prefetchProjectLists } from "./prefetchProjectLists";

const PROJECT_ORDER_STORAGE_PREFIX = "ideahome-drawer-project-order";
const PROJECT_ORDER_LEGACY_KEY = "ideahome-drawer-project-order";
const JUST_LOGGED_IN_SESSION_KEY = "ideahome-just-logged-in";

function getProjectOrderStorageKey(): string {
  return getUserScopedStorageKey(
    PROJECT_ORDER_STORAGE_PREFIX,
    PROJECT_ORDER_LEGACY_KEY
  );
}

function getFirstProjectIdFromDrawerOrder(
  projects: { id: string; name: string }[]
): string {
  if (projects.length === 0) return "";
  if (typeof window === "undefined") return projects[0].id;
  try {
    const raw = localStorage.getItem(getProjectOrderStorageKey());
    if (!raw) return projects[0].id;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return projects[0].id;
    const orderedIds = parsed.filter(
      (id): id is string => typeof id === "string"
    );
    const validIds = new Set(projects.map((project) => project.id));
    const firstOrderedExistingId = orderedIds.find((id) => validIds.has(id));
    return firstOrderedExistingId ?? projects[0].id;
  } catch {
    return projects[0].id;
  }
}

export interface UseProjectLayoutReturn {
  projects: { id: string; name: string }[];
  projectsLoaded: boolean;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  /** Project name for nav header; avoids "Select a project" flash during loading. */
  projectDisplayName: string;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  editingProjectId: string | null;
  setEditingProjectId: (id: string | null) => void;
  editingProjectName: string;
  setEditingProjectName: (name: string) => void;
  projectNameInputRef: React.RefObject<HTMLInputElement | null>;
  saveProjectName: () => Promise<void>;
  cancelEditProjectName: () => void;
  loadProjects: () => Promise<void>;
  projectToDelete: { id: string; name: string } | null;
  setProjectToDelete: (p: { id: string; name: string } | null) => void;
  projectDeleting: boolean;
  handleDeleteProject: (
    project?: { id: string; name: string } | null
  ) => Promise<void>;
  createProjectByName: (name: string) => Promise<void>;
}

export function useProjectLayout(): UseProjectLayoutReturn {
  const router = useRouter();
  const {
    selectedProjectId,
    setSelectedProjectId,
    lastKnownProjectName,
    setLastKnownProjectName,
  } = useSelectedProject();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [projectDeleting, setProjectDeleting] = useState(false);
  const projectNameInputRef = useRef<HTMLInputElement>(null);

  const selectedProjectIdRef = useRef(selectedProjectId);
  selectedProjectIdRef.current = selectedProjectId;

  const loadProjects = useCallback(() => {
    return fetchProjects()
      .then((data) => {
        setProjects(data);
        if (data.length) {
          const justLoggedIn =
            typeof window !== "undefined" &&
            sessionStorage.getItem(JUST_LOGGED_IN_SESSION_KEY) === "1";
          if (justLoggedIn) {
            sessionStorage.removeItem(JUST_LOGGED_IN_SESSION_KEY);
            setSelectedProjectId(getFirstProjectIdFromDrawerOrder(data));
            return;
          }
          const current = selectedProjectIdRef.current;
          const exists = data.some((p) => p.id === current);
          if (!exists) {
            setSelectedProjectId(getFirstProjectIdFromDrawerOrder(data));
          }
        }
      })
      .catch(() => {})
      .finally(() => setProjectsLoaded(true));
  }, [setSelectedProjectId]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    loadProjects();
  }, [router]);

  // When user has no projects, redirect to home where they can create one
  useEffect(() => {
    if (projectsLoaded && projects.length === 0 && router.pathname !== "/") {
      router.replace("/");
    }
  }, [projectsLoaded, projects.length, router]);

  useEffect(() => {
    if (selectedProjectId) prefetchProjectLists(selectedProjectId);
  }, [selectedProjectId]);

  // Sync projectId from URL when navigating from search (e.g. /todo?projectId=xxx)
  useEffect(() => {
    if (!router.isReady || !projectsLoaded) return;
    const q = router.query.projectId;
    if (typeof q !== "string" || !q) return;
    const exists = projects.some((p) => p.id === q);
    if (exists && q !== selectedProjectId) {
      setSelectedProjectId(q);
    }
  }, [
    router.isReady,
    router.query.projectId,
    projects,
    projectsLoaded,
    selectedProjectId,
    setSelectedProjectId,
  ]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const name = projects.find((p) => p.id === selectedProjectId)?.name;
    if (name) setLastKnownProjectName(name);
  }, [projects, selectedProjectId, setLastKnownProjectName]);

  useEffect(() => {
    if (editingProjectId) {
      projectNameInputRef.current?.focus();
      projectNameInputRef.current?.select();
    }
  }, [editingProjectId]);

  const saveProjectName = async () => {
    if (!editingProjectId) return;
    const name = editingProjectName.trim();
    if (!name) {
      setEditingProjectId(null);
      return;
    }
    const prev = projects.find((x) => x.id === editingProjectId);
    if (prev?.name === name) {
      setEditingProjectId(null);
      return;
    }
    try {
      const updated = await updateProject(editingProjectId, { name });
      setProjects((p) =>
        p.map((x) => (x.id === editingProjectId ? updated : x))
      );
    } catch {
      // Keep edit mode on error
    } finally {
      setEditingProjectId(null);
    }
  };

  const cancelEditProjectName = () => {
    setEditingProjectId(null);
  };

  const createProjectByName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const previousSelectedProjectId = selectedProjectIdRef.current;
      const tempId = `temp-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticProject = { id: tempId, name: trimmed };
      setProjects((prev) => [...prev, optimisticProject]);
      setSelectedProjectId(tempId);
      setLastKnownProjectName(trimmed);
      try {
        const project = await createProject({ name: trimmed });
        setProjects((prev) => prev.map((p) => (p.id === tempId ? project : p)));
        if (selectedProjectIdRef.current === tempId) {
          setSelectedProjectId(project.id);
        }
        setLastKnownProjectName(project.name);
      } catch (e) {
        setProjects((prev) => prev.filter((p) => p.id !== tempId));
        if (selectedProjectIdRef.current === tempId) {
          setSelectedProjectId(previousSelectedProjectId);
        }
        throw e;
      }
    },
    [setLastKnownProjectName, setSelectedProjectId]
  );

  const handleDeleteProject = useCallback(
    async (project?: { id: string; name: string } | null) => {
      const target = project ?? projectToDelete;
      if (!target) return;
      const previousProjects = projects;
      const previousSelectedProjectId = selectedProjectId;
      setProjectDeleting(true);
      setProjectToDelete(null);
      setProjects((prev) => prev.filter((p) => p.id !== target.id));
      if (selectedProjectId === target.id) {
        setSelectedProjectId("");
      }
      try {
        await deleteProject(target.id);
        await loadProjects();
      } catch {
        setProjects(previousProjects);
        if (previousSelectedProjectId === target.id) {
          setSelectedProjectId(previousSelectedProjectId);
        }
      } finally {
        setProjectDeleting(false);
      }
    },
    [
      projectToDelete,
      projects,
      selectedProjectId,
      setSelectedProjectId,
      loadProjects,
    ]
  );

  const projectDisplayName = getProjectDisplayName(
    projects,
    selectedProjectId,
    lastKnownProjectName,
    projectsLoaded
  );

  return {
    projects,
    projectsLoaded,
    selectedProjectId,
    setSelectedProjectId,
    projectDisplayName,
    drawerOpen,
    setDrawerOpen,
    editingProjectId,
    setEditingProjectId,
    editingProjectName,
    setEditingProjectName,
    projectNameInputRef,
    saveProjectName,
    cancelEditProjectName,
    loadProjects,
    projectToDelete,
    setProjectToDelete,
    projectDeleting,
    handleDeleteProject,
    createProjectByName,
  };
}
