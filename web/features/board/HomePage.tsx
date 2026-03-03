import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import {
  getStoredToken,
  isAuthenticated,
  isSkipLoginDev,
} from "../../lib/api/auth";
import {
  fetchProjects,
  fetchOrganizations,
  ensureOrganization,
  createOrganization,
  createProject,
  updateProject,
  deleteProject,
  type Organization,
  type Project,
} from "../../lib/api/projects";
import {
  fetchIssues,
  fetchIssue,
  updateIssueStatus,
  deleteIssue,
  deleteAllIssues,
  STATUSES,
  type Issue,
} from "../../lib/api/issues";
import { type User } from "../../lib/api/users";
import { AppLayout } from "../../components/AppLayout";
import { AutoResizeTextarea } from "../../components/AutoResizeTextarea";
import { ConfirmModal } from "../../components/ConfirmModal";
import { CreateIssueModal } from "../../components/CreateIssueModal";
import { CreateProjectModal } from "../../components/CreateProjectModal";
import { ErrorBanner } from "../../components/ErrorBanner";
import {
  IconDownload,
  IconEdit,
  IconMic,
  IconPlay,
  IconRecordCamera,
  IconRecordScreen,
  IconScreenshot,
  IconStop,
  IconUpload,
  IconVideo,
  IconX,
} from "../../components/icons";
import { IconTrash } from "../../components/IconTrash";
import { SectionLoadingSpinner } from "../../components/SectionLoadingSpinner";
import { useSelectedProject } from "../../lib/SelectedProjectContext";
import { getProjectDisplayName } from "../../lib/utils";
import { useBoardCreateIssue } from "./useBoardCreateIssue";
import { useBoardDnd } from "./useBoardDnd";
import { useHomePageIssueDetail } from "./useHomePageIssueDetail";
import { IssueDetailModal } from "./IssueDetailModal";
import { BoardColumn, IssueCard } from "./BoardDnd";
import { useTheme } from "../../pages/_app";

export default function Home() {
  type CustomColumn = { id: string; label: string };
  const CUSTOM_COLUMNS_STORAGE_KEY = "ideahome-custom-board-columns";
  const COLUMN_ORDER_STORAGE_KEY = "ideahome-board-column-order";
  const DEFAULT_COLUMN_ORDER = STATUSES.map((status) => status.id);
  const router = useRouter();
  const [authResolved, setAuthResolved] = useState(false);
  const {
    selectedProjectId,
    setSelectedProjectId,
    lastKnownProjectName,
    setLastKnownProjectName,
  } = useSelectedProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectOrgId, setNewProjectOrgId] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [projectCreateError, setProjectCreateError] = useState<string | null>(
    null
  );
  const [projectSubmitting, setProjectSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnError, setNewColumnError] = useState<string | null>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  const createIssueForm = useBoardCreateIssue({
    selectedProjectId: selectedProjectId ?? "",
    projects,
    setIssues,
    setSelectedProjectId,
    setError,
  });
  const {
    createOpen,
    setCreateOpen,
    createTitle,
    setCreateTitle,
    createDescription,
    setCreateDescription,
    createAcceptanceCriteria,
    setCreateAcceptanceCriteria,
    createDatabase,
    setCreateDatabase,
    createApi,
    setCreateApi,
    createTestCases,
    setCreateTestCases,
    createAssigneeId,
    setCreateAssigneeId,
    users,
    submitting,
    createError,
    setCreateError,
    handleCreate,
  } = createIssueForm;
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [projectDeleting, setProjectDeleting] = useState(false);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);
  const [issueDeleting, setIssueDeleting] = useState(false);
  const issueDetailModalProps = useHomePageIssueDetail({
    selectedIssue,
    setSelectedIssue,
    issues,
    setIssues,
    setError,
    users,
    setIssueToDelete,
  });
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [deleteAllDeleting, setDeleteAllDeleting] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const projectNameInputRef = useRef<HTMLInputElement>(null);

  const selectedProjectIdRef = useRef(selectedProjectId);
  selectedProjectIdRef.current = selectedProjectId;
  const handledCreateProjectQueryRef = useRef<string | null>(null);

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
      if (data.length) {
        const current = selectedProjectIdRef.current;
        const exists = data.some((p) => p.id === current);
        if (!exists) setSelectedProjectId(data[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setProjectsLoaded(true);
    }
  };

  const loadIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIssues(selectedProjectId || undefined);
      setIssues(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load issues");
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSkipLoginDev()) {
      setAuthResolved(true);
      loadProjects();
      return;
    }
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    setAuthResolved(true);
    loadProjects();
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CUSTOM_COLUMNS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const sanitized = parsed
        .filter(
          (entry): entry is { id: string; label: string } =>
            !!entry &&
            typeof entry === "object" &&
            typeof (entry as { id?: unknown }).id === "string" &&
            typeof (entry as { label?: unknown }).label === "string"
        )
        .map((entry) => ({
          id: entry.id.trim(),
          label: entry.label.trim(),
        }))
        .filter((entry) => entry.id && entry.label);
      setCustomColumns(sanitized);
    } catch {
      // Ignore malformed local data.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      CUSTOM_COLUMNS_STORAGE_KEY,
      JSON.stringify(customColumns)
    );
  }, [customColumns]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(COLUMN_ORDER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const sanitized = parsed.filter(
        (entry): entry is string => typeof entry === "string" && !!entry.trim()
      );
      if (!sanitized.length) return;
      setColumnOrder(sanitized);
    } catch {
      // Ignore malformed local data.
    }
  }, []);

  useEffect(() => {
    const availableIds = [
      ...STATUSES.map((status) => status.id),
      ...customColumns.map((column) => column.id),
    ];
    setColumnOrder((prev) => {
      const filtered = prev.filter((id) => availableIds.includes(id));
      const missing = availableIds.filter((id) => !filtered.includes(id));
      const next = [...filtered, ...missing];
      if (
        next.length === prev.length &&
        next.every((id, index) => id === prev[index])
      ) {
        return prev;
      }
      return next;
    });
  }, [customColumns]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      COLUMN_ORDER_STORAGE_KEY,
      JSON.stringify(columnOrder)
    );
  }, [columnOrder]);

  // When token is cleared (e.g. logout in another tab), redirect to login
  useEffect(() => {
    if (!authResolved) return;
    const check = () => {
      if (!isAuthenticated()) router.replace("/login");
    };
    window.addEventListener("storage", check);
    const interval = setInterval(check, 1000);
    return () => {
      window.removeEventListener("storage", check);
      clearInterval(interval);
    };
  }, [authResolved, router]);

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
      // Keep edit mode on error; user can retry or cancel
    } finally {
      setEditingProjectId(null);
    }
  };

  const cancelEditProjectName = () => {
    setEditingProjectId(null);
  };

  const handleCreateProjectWithName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const previousSelectedProjectId = selectedProjectId;
      const tempId = `temp-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticProject: Project = { id: tempId, name: trimmed };
      setProjectCreateError(null);
      setProjectSubmitting(true);
      setProjects((prev) => [...prev, optimisticProject]);
      setSelectedProjectId(tempId);
      setLastKnownProjectName(trimmed);
      try {
        if (organizations.length === 0) {
          await ensureOrganization();
          const list = await fetchOrganizations();
          setOrganizations(list);
        }
        const project = await createProject({ name: trimmed });
        setProjects((prev) => prev.map((p) => (p.id === tempId ? project : p)));
        if (selectedProjectIdRef.current === tempId) {
          setSelectedProjectId(project.id);
        }
        setLastKnownProjectName(project.name);
        if (router.pathname !== "/") {
          await router.push("/");
        }
      } catch (e) {
        setProjects((prev) => prev.filter((p) => p.id !== tempId));
        if (selectedProjectIdRef.current === tempId) {
          setSelectedProjectId(previousSelectedProjectId);
        }
        setProjectCreateError(
          e instanceof Error ? e.message : "Failed to create project"
        );
      } finally {
        setProjectSubmitting(false);
      }
    },
    [
      organizations.length,
      selectedProjectId,
      setLastKnownProjectName,
      setSelectedProjectId,
    ]
  );

  useEffect(() => {
    loadIssues();
  }, [selectedProjectId]);

  useEffect(() => {
    const issueId = router.query.issueId;
    if (!router.isReady || typeof issueId !== "string" || !issueId) return;
    fetchIssue(issueId)
      .then((issue) => {
        setSelectedProjectId(issue.projectId);
        setSelectedIssue(issue);
        router.replace("/", undefined, { shallow: true });
      })
      .catch(() => {});
  }, [router.isReady, router.query.issueId]);

  // When user has no projects, prompt them to add one at the beginning
  const hasPromptedNoProjectsRef = useRef(false);
  useEffect(() => {
    if (
      projectsLoaded &&
      projects.length === 0 &&
      !hasPromptedNoProjectsRef.current
    ) {
      hasPromptedNoProjectsRef.current = true;
      setCreateProjectOpen(true);
    }
  }, [projectsLoaded, projects.length]);

  useEffect(() => {
    if (createProjectOpen) {
      setProjectCreateError(null);
      fetchOrganizations()
        .then((data) => {
          setOrganizations(data);
          if (data.length > 0) setNewProjectOrgId(data[0].id);
        })
        .catch(() => setOrganizations([]));
    }
  }, [createProjectOpen]);

  // Open create project modal when navigating with ?createProject=1 (e.g. from project switcher)
  // When projectName is provided, create directly without opening modal
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.createProject;
    const nameParam = router.query.projectName;
    const name =
      typeof nameParam === "string" && nameParam.trim()
        ? nameParam.trim()
        : null;
    if (q !== "1") {
      handledCreateProjectQueryRef.current = null;
      return;
    }
    const queryKey = name ?? "__open_modal__";
    if (handledCreateProjectQueryRef.current === queryKey) return;
    handledCreateProjectQueryRef.current = queryKey;
    if (q === "1") {
      router.replace("/", undefined, { shallow: true });
      if (name) {
        void handleCreateProjectWithName(name);
      } else {
        setCreateProjectOpen(true);
      }
    }
  }, [
    router.isReady,
    router.query.createProject,
    router.query.projectName,
    handleCreateProjectWithName,
  ]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    const previous = issues.find((i) => i.id === id);
    if (!previous || previous.status === newStatus) return;
    setError(null);
    const optimistic = { ...previous, status: newStatus };
    setIssues((prev) => prev.map((i) => (i.id === id ? optimistic : i)));
    if (selectedIssue?.id === id) {
      setSelectedIssue(optimistic);
    }
    try {
      const updated = await updateIssueStatus(id, newStatus);
      setIssues((prev) => prev.map((i) => (i.id === id ? updated : i)));
      if (selectedIssue?.id === id) {
        setSelectedIssue(updated);
      }
    } catch (e) {
      setIssues((prev) => prev.map((i) => (i.id === id ? previous : i)));
      if (selectedIssue?.id === id) {
        setSelectedIssue(previous);
      }
      setError(
        e instanceof Error
          ? e.message
          : "Status change could not be saved. It will not persist after refresh."
      );
    }
  };

  const createCustomColumn = useCallback(
    (label: string) => {
      const usedIds = new Set([
        ...STATUSES.map((status) => status.id),
        ...customColumns.map((column) => column.id),
      ]);
      const baseSlug =
        label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "") || "column";

      let nextId = `custom_${baseSlug}`;
      let suffix = 2;
      while (usedIds.has(nextId)) {
        nextId = `custom_${baseSlug}_${suffix}`;
        suffix += 1;
      }

      setCustomColumns((prev) => [...prev, { id: nextId, label }]);
    },
    [customColumns]
  );

  const handleAddCustomColumn = useCallback(() => {
    setNewColumnName("");
    setNewColumnError(null);
    setAddColumnModalOpen(true);
  }, []);

  const handleSubmitNewColumn = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const label = newColumnName.trim();
      if (!label) {
        setNewColumnError("Enter a column name.");
        return;
      }
      const duplicate = customColumns.some(
        (column) => column.label.toLowerCase() === label.toLowerCase()
      );
      if (duplicate) {
        setNewColumnError("That column already exists.");
        return;
      }
      createCustomColumn(label);
      setAddColumnModalOpen(false);
      setNewColumnName("");
      setNewColumnError(null);
    },
    [createCustomColumn, customColumns, newColumnName]
  );

  const handleDeleteProject = async (project?: Project | null) => {
    const target = project ?? projectToDelete;
    if (!target) return;
    const previousProjects = projects;
    const previousIssues = issues;
    const previousSelectedProjectId = selectedProjectId;
    setProjectDeleting(true);
    setError(null);
    setProjectToDelete(null);
    setProjects((prev) => prev.filter((p) => p.id !== target.id));
    setIssues((prev) => prev.filter((i) => i.projectId !== target.id));
    if (selectedProjectId === target.id) {
      setSelectedProjectId("");
      setIssues([]);
    }
    try {
      await deleteProject(target.id);
      await loadProjects();
    } catch (e) {
      setProjects(previousProjects);
      setIssues(previousIssues);
      if (previousSelectedProjectId === target.id) {
        setSelectedProjectId(previousSelectedProjectId);
      }
      setError(e instanceof Error ? e.message : "Failed to delete project");
    } finally {
      setProjectDeleting(false);
    }
  };

  const handleDeleteIssue = async () => {
    if (!issueToDelete) return;
    setIssueDeleting(true);
    setError(null);
    try {
      await deleteIssue(issueToDelete.id);
      setIssues((prev) => prev.filter((i) => i.id !== issueToDelete.id));
      if (selectedIssue?.id === issueToDelete.id) {
        setSelectedIssue(null);
      }
      setIssueToDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete issue");
    } finally {
      setIssueDeleting(false);
    }
  };

  const handleDeleteAllIssues = async () => {
    setDeleteAllDeleting(true);
    setError(null);
    try {
      await deleteAllIssues(selectedProjectId || undefined);
      setIssues([]);
      setSelectedIssue(null);
      setDeleteAllConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete issues");
    } finally {
      setDeleteAllDeleting(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setProjectCreateError(null);
    const projectName = newProjectName.trim();
    if (!projectName) {
      setProjectCreateError("Please enter a project name.");
      return;
    }
    const previousSelectedProjectId = selectedProjectId;
    const tempId = `temp-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticProject: Project = { id: tempId, name: projectName };
    setProjectSubmitting(true);
    setProjects((prev) => [...prev, optimisticProject]);
    setSelectedProjectId(tempId);
    setLastKnownProjectName(projectName);
    try {
      if (organizations.length === 0) {
        if (newOrgName.trim()) {
          await createOrganization({ name: newOrgName.trim() });
        } else {
          await ensureOrganization();
        }
        const list = await fetchOrganizations();
        setOrganizations(list);
        if (list.length > 0) setNewProjectOrgId(list[0].id);
      }
      const project = await createProject({ name: projectName });
      setProjects((prev) => prev.map((p) => (p.id === tempId ? project : p)));
      if (selectedProjectIdRef.current === tempId) {
        setSelectedProjectId(project.id);
      }
      setLastKnownProjectName(project.name);
      if (router.pathname !== "/") {
        await router.push("/");
      }
      setCreateProjectOpen(false);
      setNewProjectName("");
      setNewProjectOrgId("");
      setNewOrgName("");
    } catch (e) {
      setProjects((prev) => prev.filter((p) => p.id !== tempId));
      if (selectedProjectIdRef.current === tempId) {
        setSelectedProjectId(previousSelectedProjectId);
      }
      setProjectCreateError(
        e instanceof Error ? e.message : "Failed to create project"
      );
    } finally {
      setProjectSubmitting(false);
    }
  };

  const boardDnd = useBoardDnd(issues, handleStatusChange);
  const orderedColumns = useMemo(() => {
    type BoardColumnDef = { id: string; label: string; type: "status" | "custom" };
    const allMap = new Map<string, BoardColumnDef>();
    for (const status of STATUSES) {
      allMap.set(status.id, {
        id: status.id,
        label: status.label,
        type: "status",
      });
    }
    for (const customColumn of customColumns) {
      allMap.set(customColumn.id, {
        id: customColumn.id,
        label: customColumn.label,
        type: "custom",
      });
    }
    const ordered: BoardColumnDef[] = [];
    for (const id of columnOrder) {
      const column = allMap.get(id);
      if (column) {
        ordered.push(column);
      }
    }
    return ordered;
  }, [columnOrder, customColumns]);

  const handleBoardDragStart = useCallback(
    (event: DragStartEvent) => {
      const dragType = (event.active.data.current as { type?: string } | undefined)
        ?.type;
      if (dragType === "column") {
        const columnId = (
          event.active.data.current as { columnId?: string } | undefined
        )?.columnId;
        setDraggingColumnId(columnId ?? null);
        return;
      }
      boardDnd.handleBoardDragStart(event);
    },
    [boardDnd]
  );

  const handleBoardDragOver = useCallback(
    (event: DragOverEvent) => {
      const dragType = (event.active.data.current as { type?: string } | undefined)
        ?.type;
      if (dragType === "column") return;
      boardDnd.handleBoardDragOver(event);
    },
    [boardDnd]
  );

  const handleBoardDragEnd = useCallback(
    (event: DragEndEvent) => {
      const dragType = (event.active.data.current as { type?: string } | undefined)
        ?.type;
      if (dragType === "column") {
        setDraggingColumnId(null);
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const activeColumnId = (active.id as string).replace(/^column-/, "");
        const overColumnId = (over.id as string).replace(/^column-/, "");
        const from = columnOrder.indexOf(activeColumnId);
        const to = columnOrder.indexOf(overColumnId);
        if (from === -1 || to === -1) return;
        const next = [...columnOrder];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setColumnOrder(next);
        return;
      }
      boardDnd.handleBoardDragEnd(event);
    },
    [boardDnd, columnOrder]
  );

  const handleBoardDragCancel = useCallback(() => {
    setDraggingColumnId(null);
    boardDnd.handleBoardDragCancel();
  }, [boardDnd]);

  if (!authResolved || !isAuthenticated()) {
    return null;
  }

  const projectDisplayName = getProjectDisplayName(
    projects,
    selectedProjectId,
    lastKnownProjectName,
    projectsLoaded
  );

  return (
    <AppLayout
      title="Idea Home"
      activeTab="board"
      projectName={projectDisplayName}
      projectId={selectedProjectId || undefined}
      searchPlaceholder="Search project"
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      projects={projects}
      selectedProjectId={selectedProjectId ?? ""}
      setSelectedProjectId={setSelectedProjectId}
      editingProjectId={editingProjectId}
      setEditingProjectId={setEditingProjectId}
      editingProjectName={editingProjectName}
      setEditingProjectName={setEditingProjectName}
      saveProjectName={saveProjectName}
      cancelEditProjectName={cancelEditProjectName}
      projectNameInputRef={projectNameInputRef}
      theme={theme}
      toggleTheme={toggleTheme}
      projectToDelete={projectToDelete}
      setProjectToDelete={setProjectToDelete}
      projectDeleting={projectDeleting}
      handleDeleteProject={handleDeleteProject}
      onNewProjectClick={() => setCreateProjectOpen(true)}
      onAddClick={() => setCreateOpen(true)}
      onCreateProject={handleCreateProjectWithName}
      onDeleteAllIssuesClick={() => setDeleteAllConfirmOpen(true)}
      deleteAllIssuesDisabled={loading || issues.length === 0}
    >
      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}

      <div className="board-container">
        {loading ? (
          <div className="tests-page-single-loading">
            <SectionLoadingSpinner />
          </div>
        ) : (
          <DndContext
            sensors={boardDnd.boardSensors}
            collisionDetection={closestCenter}
            onDragStart={handleBoardDragStart}
            onDragOver={handleBoardDragOver}
            onDragEnd={handleBoardDragEnd}
            onDragCancel={handleBoardDragCancel}
          >
            <SortableContext
              items={orderedColumns.map((column) => `column-${column.id}`)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="board-columns">
                {orderedColumns.map((column) => {
                  if (column.type === "status") {
                    const columnIssues =
                      boardDnd.issuesByStatusForDisplay[column.id] ?? [];
                    const isPreviewColumn =
                      boardDnd.dragOverColumnId === column.id &&
                      boardDnd.draggingIssueId;
                    return (
                      <BoardColumn
                        key={column.id}
                        id={column.id}
                        label={column.label}
                        count={columnIssues.length}
                        isDropTarget={boardDnd.dragOverColumnId === column.id}
                        droppableStatus={column.id}
                        isSorting={draggingColumnId === column.id}
                      >
                        {columnIssues.map((issue) => (
                          <IssueCard
                            key={issue.id}
                            issue={issue}
                            onSelect={setSelectedIssue}
                            draggingIssueId={boardDnd.draggingIssueId}
                            isPreview={
                              !!(
                                isPreviewColumn &&
                                issue.id === boardDnd.draggingIssueId
                              )
                            }
                          />
                        ))}
                      </BoardColumn>
                    );
                  }

                  return (
                    <BoardColumn
                      key={column.id}
                      id={column.id}
                      label={column.label}
                      count={0}
                      isDropTarget={false}
                      isSorting={draggingColumnId === column.id}
                    >
                      <div />
                    </BoardColumn>
                  );
                })}
                <div className="board-add-column">
                  <button
                    type="button"
                    className="board-add-column-button"
                    onClick={handleAddCustomColumn}
                    aria-label="Add a column"
                  >
                    <span className="board-add-column-plus" aria-hidden="true">
                      +
                    </span>
                  </button>
                </div>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {addColumnModalOpen && (
        <div
          className="modal-overlay board-add-column-overlay"
          onClick={() => setAddColumnModalOpen(false)}
        >
          <div className="modal board-add-column-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add column</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setAddColumnModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitNewColumn}>
              <div className="form-group board-add-column-field">
                <label htmlFor="new-column-name">Column name</label>
                <input
                  id="new-column-name"
                  value={newColumnName}
                  onChange={(e) => {
                    setNewColumnName(e.target.value);
                    if (newColumnError) setNewColumnError(null);
                  }}
                  placeholder="e.g. Blocked"
                  autoFocus
                />
                {newColumnError && <div className="board-add-column-error">{newColumnError}</div>}
              </div>
              <div className="modal-actions board-add-column-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAddColumnModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CreateIssueModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projects={projects}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        title={createTitle}
        setTitle={setCreateTitle}
        description={createDescription}
        setDescription={setCreateDescription}
        acceptanceCriteria={createAcceptanceCriteria}
        setAcceptanceCriteria={setCreateAcceptanceCriteria}
        database={createDatabase}
        setDatabase={setCreateDatabase}
        api={createApi}
        setApi={setCreateApi}
        testCases={createTestCases}
        setTestCases={setCreateTestCases}
        assigneeId={createAssigneeId}
        setAssigneeId={setCreateAssigneeId}
        users={users}
        error={createError}
        onDismissError={() => setCreateError(null)}
        submitting={submitting}
        onSubmit={handleCreate}
      />

      {issueToDelete && (
        <ConfirmModal
          title="Delete issue"
          message={
            <>
              Delete &quot;{issueToDelete.title || "Untitled"}&quot;? This will
              permanently remove the issue.
            </>
          }
          confirmLabel="Delete"
          confirmBusyLabel="Deleting…"
          busy={issueDeleting}
          onClose={() => setIssueToDelete(null)}
          onConfirm={handleDeleteIssue}
          modalStyle={{ maxWidth: 400 }}
          overlayClassName="modal-overlay--above-detail"
        />
      )}

      {deleteAllConfirmOpen && (
        <ConfirmModal
          title="Delete all issues"
          message={
            selectedProjectId
              ? "Permanently delete all issues in this project?"
              : "Permanently delete all issues? This cannot be undone."
          }
          confirmLabel="Delete all"
          confirmBusyLabel="Deleting…"
          busy={deleteAllDeleting}
          onClose={() => setDeleteAllConfirmOpen(false)}
          onConfirm={handleDeleteAllIssues}
          modalStyle={{ maxWidth: 400 }}
        />
      )}

      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        organizations={organizations}
        newOrgName={newOrgName}
        setNewOrgName={setNewOrgName}
        newProjectOrgId={newProjectOrgId}
        setNewProjectOrgId={setNewProjectOrgId}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        error={projectCreateError}
        onDismissError={() => setProjectCreateError(null)}
        submitting={projectSubmitting}
        onSubmit={handleCreateProject}
      />

      {issueDetailModalProps && (
        <IssueDetailModal {...issueDetailModalProps} />
      )}
    </AppLayout>
  );
}
