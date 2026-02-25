import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  deleteProject,
  fetchProjects,
  isAuthenticated,
  updateProject,
} from "./api";
import { useSelectedProject } from "./SelectedProjectContext";
import { prefetchProjectLists } from "./prefetchProjectLists";

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
  handleDeleteProject: () => Promise<void>;
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
          const current = selectedProjectIdRef.current;
          const exists = data.some((p) => p.id === current);
          if (!exists) setSelectedProjectId(data[0].id);
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

  const handleDeleteProject = useCallback(async () => {
    if (!projectToDelete) return;
    setProjectDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      setProjectToDelete(null);
      if (selectedProjectId === projectToDelete.id) {
        setSelectedProjectId("");
      }
      await loadProjects();
    } finally {
      setProjectDeleting(false);
    }
  }, [projectToDelete, selectedProjectId, setSelectedProjectId, loadProjects]);

  const projectDisplayName =
    projects.find((p) => p.id === selectedProjectId)?.name ??
    (selectedProjectId && lastKnownProjectName
      ? lastKnownProjectName
      : selectedProjectId
        ? "Project"
        : projectsLoaded && projects.length
          ? "Select a project"
          : "Project");

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
  };
}
