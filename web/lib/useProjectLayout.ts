import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  fetchProjects,
  isAuthenticated,
  updateProject,
} from "./api";
import { prefetchProjectLists } from "./prefetchProjectLists";

export interface UseProjectLayoutReturn {
  projects: { id: string; name: string }[];
  projectsLoaded: boolean;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
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
}

export function useProjectLayout(): UseProjectLayoutReturn {
  const router = useRouter();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const projectNameInputRef = useRef<HTMLInputElement>(null);

  const loadProjects = () =>
    fetchProjects()
      .then((data) => {
        setProjects(data);
        if (data.length && !selectedProjectId) setSelectedProjectId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setProjectsLoaded(true));

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    loadProjects();
  }, [router]);

  useEffect(() => {
    if (selectedProjectId) prefetchProjectLists(selectedProjectId);
  }, [selectedProjectId]);

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

  return {
    projects,
    projectsLoaded,
    selectedProjectId,
    setSelectedProjectId,
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
  };
}
