import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { closestCenter, DndContext } from "@dnd-kit/core";
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
            onDragStart={boardDnd.handleBoardDragStart}
            onDragOver={boardDnd.handleBoardDragOver}
            onDragEnd={boardDnd.handleBoardDragEnd}
            onDragCancel={boardDnd.handleBoardDragCancel}
          >
            <div className="board-columns">
              {STATUSES.map(({ id, label }) => {
                const columnIssues = boardDnd.issuesByStatusForDisplay[id] ?? [];
                const isPreviewColumn =
                  boardDnd.dragOverColumnId === id && boardDnd.draggingIssueId;
                return (
                  <BoardColumn
                    key={id}
                    id={id}
                    label={label}
                    count={columnIssues.length}
                    isDropTarget={boardDnd.dragOverColumnId === id}
                  >
                    {columnIssues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        onSelect={setSelectedIssue}
                        draggingIssueId={boardDnd.draggingIssueId}
                        isPreview={
                          !!(isPreviewColumn && issue.id === boardDnd.draggingIssueId)
                        }
                      />
                    ))}
                  </BoardColumn>
                );
              })}
            </div>
          </DndContext>
        )}
      </div>

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
