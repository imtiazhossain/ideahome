import React from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { getUserScopedStorageKey } from "../lib/api";
import { DeleteProjectModal } from "./DeleteProjectModal";
import { IconTrash } from "./IconTrash";
import {
  ProjectNavBar,
  DrawerCollapsedNav,
  useTabOrder,
} from "./ProjectNavBar";
import type { ProjectNavTabId } from "./ProjectNavBar";

const NAV_LINKS: { href: string; label: string; tabId: ProjectNavTabId }[] = [
  { href: "/", label: "Dashboard", tabId: "board" },
  { href: "/todo", label: "To-Do", tabId: "todo" },
  { href: "/ideas", label: "Ideas", tabId: "ideas" },
  { href: "/tests", label: "Tests", tabId: "tests" },
  { href: "/features", label: "Features", tabId: "list" },
  { href: "/bugs", label: "Bugs", tabId: "forms" },
  { href: "/expenses", label: "Expenses", tabId: "expenses" },
];

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
  const deduped = orderIds.filter((id, idx) => validIds.has(id) && orderIds.indexOf(id) === idx);
  const missing = projects.map((p) => p.id).filter((id) => !deduped.includes(id));
  return [...deduped, ...missing];
}

function loadProjectOrderIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getProjectOrderStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function saveProjectOrderIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getProjectOrderStorageKey(), JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export interface AppLayoutProps {
  title: string;
  activeTab: ProjectNavTabId;
  projectName: string;
  projectId: string | undefined;
  searchPlaceholder: string;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  projects: { id: string; name: string }[];
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  editingProjectId: string | null;
  setEditingProjectId: (id: string | null) => void;
  editingProjectName: string;
  setEditingProjectName: (name: string) => void;
  saveProjectName: () => void;
  cancelEditProjectName: () => void;
  projectNameInputRef: React.RefObject<HTMLInputElement | null>;
  theme: string;
  toggleTheme: () => void;
  projectToDelete: { id: string; name: string } | null;
  setProjectToDelete: (p: { id: string; name: string } | null) => void;
  projectDeleting: boolean;
  handleDeleteProject: () => Promise<void>;
  /** When true, show delete button next to each project in the drawer */
  showDeletePerProject?: boolean;
  /** When provided, show "+ New project" button in drawer that calls this */
  onNewProjectClick?: () => void;
  /** Pass through to ProjectNavBar */
  onAddClick?: () => void;
  /** Override default create project (router.push). When provided, used instead. */
  onCreateProject?: (name: string) => void | Promise<void>;
  /** Pass through to ProjectNavBar */
  onDeleteAllIssuesClick?: () => void;
  /** Pass through to ProjectNavBar */
  deleteAllIssuesDisabled?: boolean;
  children: React.ReactNode;
}

export function AppLayout({
  title,
  activeTab,
  projectName,
  projectId,
  searchPlaceholder,
  drawerOpen,
  setDrawerOpen,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  editingProjectId,
  setEditingProjectId,
  editingProjectName,
  setEditingProjectName,
  saveProjectName,
  cancelEditProjectName,
  projectNameInputRef,
  theme,
  toggleTheme,
  projectToDelete,
  setProjectToDelete,
  projectDeleting,
  handleDeleteProject,
  showDeletePerProject = false,
  onNewProjectClick,
  onAddClick,
  onCreateProject,
  onDeleteAllIssuesClick,
  deleteAllIssuesDisabled,
  children,
}: AppLayoutProps) {
  const router = useRouter();
  const { tabOrder, setTabOrder } = useTabOrder();
  const [projectOrderIds, setProjectOrderIds] = React.useState<string[]>([]);
  const [draggedProjectId, setDraggedProjectId] = React.useState<string | null>(
    null
  );
  const [dragOverProjectId, setDragOverProjectId] = React.useState<
    string | null
  >(null);
  const [draggedSectionTabId, setDraggedSectionTabId] = React.useState<
    ProjectNavTabId | null
  >(null);
  const [dragOverSectionTabId, setDragOverSectionTabId] = React.useState<
    ProjectNavTabId | null
  >(null);

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

  const moveProjectBefore = React.useCallback(
    (draggedId: string, targetId: string) => {
      if (!draggedId || !targetId || draggedId === targetId) return;
      const next = [...mergeProjectOrder(projects, projectOrderIds)];
      const from = next.indexOf(draggedId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1 || from === to) return;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setProjectOrderIds(next);
    },
    [projectOrderIds, projects]
  );

  const moveSectionBefore = React.useCallback(
    (draggedId: ProjectNavTabId, targetId: ProjectNavTabId) => {
      if (!draggedId || !targetId || draggedId === targetId) return;
      const from = tabOrder.indexOf(draggedId);
      const to = tabOrder.indexOf(targetId);
      if (from === -1 || to === -1 || from === to) return;
      const next = [...tabOrder];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setTabOrder(next);
    },
    [setTabOrder, tabOrder]
  );
  const orderedNavLinks = React.useMemo(() => {
    const byId = new Map(NAV_LINKS.map((l) => [l.tabId, l]));
    const ordered = tabOrder
      .map((id) => byId.get(id))
      .filter(
        (
          link
        ): link is { href: string; label: string; tabId: ProjectNavTabId } =>
          Boolean(link)
      );
    const missing = NAV_LINKS.filter(
      (link) => !ordered.some((item) => item.tabId === link.tabId)
    );
    return [...ordered, ...missing];
  }, [tabOrder]);

  const closeDrawerOnMobile = React.useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches
    ) {
      setDrawerOpen(false);
    }
  }, [setDrawerOpen]);
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}
      <div className="app-layout">
        <aside
          className={`drawer ${drawerOpen ? "drawer-open" : "drawer-closed"}`}
        >
          {drawerOpen ? (
            <>
              <div className="drawer-logo" aria-hidden>
                IH
              </div>
              <div className="drawer-header">
                <div className="drawer-title">Idea Home</div>
                <button
                  type="button"
                  className="drawer-toggle"
                  onClick={() => setDrawerOpen((o) => !o)}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  ◀
                </button>
              </div>
              <div className="drawer-content">
                <nav className="drawer-nav">
                  <div className="drawer-nav-label">Projects</div>
                  {orderedProjects.map((p) => (
                    <div
                      key={p.id}
                      data-project-id={p.id}
                      className={`drawer-nav-item-row ${editingProjectId === p.id ? "" : "is-draggable"}${draggedProjectId === p.id ? " is-dragging" : ""}${dragOverProjectId === p.id && draggedProjectId !== p.id ? " is-drag-over" : ""}`}
                      draggable={editingProjectId !== p.id}
                      onDragStart={(e) => {
                        if (editingProjectId === p.id) return;
                        setDraggedProjectId(p.id);
                        setDragOverProjectId(null);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", p.id);
                      }}
                      onDragOver={(e) => {
                        if (!draggedProjectId || draggedProjectId === p.id) return;
                        e.preventDefault();
                        if (dragOverProjectId !== p.id) setDragOverProjectId(p.id);
                      }}
                      onDragLeave={() => {
                        if (dragOverProjectId === p.id) setDragOverProjectId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!draggedProjectId || draggedProjectId === p.id) return;
                        moveProjectBefore(draggedProjectId, p.id);
                        setDragOverProjectId(null);
                      }}
                      onTouchStart={() => {
                        if (editingProjectId === p.id) return;
                        setDraggedProjectId(p.id);
                        setDragOverProjectId(null);
                      }}
                      onTouchMove={(e) => {
                        if (!draggedProjectId) return;
                        const touch = e.touches[0];
                        if (!touch) return;
                        const el = document.elementFromPoint(
                          touch.clientX,
                          touch.clientY
                        ) as HTMLElement | null;
                        const row = el?.closest(
                          "[data-project-id]"
                        ) as HTMLElement | null;
                        const targetId = row?.dataset.projectId ?? null;
                        if (targetId && targetId !== draggedProjectId) {
                          e.preventDefault();
                          if (dragOverProjectId !== targetId) {
                            setDragOverProjectId(targetId);
                          }
                        }
                      }}
                      onTouchEnd={() => {
                        if (draggedProjectId && dragOverProjectId) {
                          moveProjectBefore(draggedProjectId, dragOverProjectId);
                        }
                        setDraggedProjectId(null);
                        setDragOverProjectId(null);
                      }}
                      onTouchCancel={() => {
                        setDraggedProjectId(null);
                        setDragOverProjectId(null);
                      }}
                      onDragEnd={() => {
                        setDraggedProjectId(null);
                        setDragOverProjectId(null);
                      }}
                    >
                      {editingProjectId === p.id ? (
                        <input
                          ref={
                            projectNameInputRef as React.RefObject<HTMLInputElement>
                          }
                          type="text"
                          className="drawer-nav-item drawer-nav-item-input"
                          value={editingProjectName}
                          onChange={(e) =>
                            setEditingProjectName(e.target.value)
                          }
                          onBlur={saveProjectName}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveProjectName();
                            if (e.key === "Escape") cancelEditProjectName();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Project name"
                        />
                      ) : (
                        <button
                          type="button"
                          className={`drawer-nav-item ${selectedProjectId === p.id ? "is-selected" : ""}`}
                          onClick={() => {
                            setSelectedProjectId(p.id);
                            closeDrawerOnMobile();
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingProjectId(p.id);
                            setEditingProjectName(p.name);
                          }}
                          title="Double-click to edit name"
                        >
                          {p.name}
                        </button>
                      )}
                      {editingProjectId !== p.id && (
                        <button
                          type="button"
                          className="drawer-nav-item-edit"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingProjectId(p.id);
                            setEditingProjectName(p.name);
                          }}
                          aria-label={`Rename ${p.name}`}
                          title={`Rename project "${p.name}"`}
                        >
                          ✎
                        </button>
                      )}
                      {showDeletePerProject && (
                        <button
                          type="button"
                          className="drawer-nav-item-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(p);
                          }}
                          aria-label={`Delete ${p.name}`}
                          title={`Delete project "${p.name}"`}
                        >
                          <IconTrash />
                        </button>
                      )}
                    </div>
                  ))}
                  {onNewProjectClick && (
                    <button
                      type="button"
                      className="drawer-nav-item drawer-nav-item-action"
                      onClick={onNewProjectClick}
                    >
                      + New project
                    </button>
                  )}
                  <div className="drawer-nav-label">Sections</div>
                  {orderedNavLinks.map(({ href, label, tabId }) => (
                    <div
                      key={href}
                      data-section-tab-id={tabId}
                      className={`drawer-nav-section-row${draggedSectionTabId === tabId ? " is-dragging" : ""}${dragOverSectionTabId === tabId && draggedSectionTabId !== tabId ? " is-drag-over" : ""}`}
                      draggable
                      onDragStart={(e) => {
                        setDraggedSectionTabId(tabId);
                        setDragOverSectionTabId(null);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", tabId);
                      }}
                      onDragOver={(e) => {
                        if (!draggedSectionTabId || draggedSectionTabId === tabId)
                          return;
                        e.preventDefault();
                        if (dragOverSectionTabId !== tabId) {
                          setDragOverSectionTabId(tabId);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverSectionTabId === tabId) {
                          setDragOverSectionTabId(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!draggedSectionTabId || draggedSectionTabId === tabId)
                          return;
                        moveSectionBefore(draggedSectionTabId, tabId);
                        setDragOverSectionTabId(null);
                      }}
                      onTouchStart={() => {
                        setDraggedSectionTabId(tabId);
                        setDragOverSectionTabId(null);
                      }}
                      onTouchMove={(e) => {
                        if (!draggedSectionTabId) return;
                        const touch = e.touches[0];
                        if (!touch) return;
                        const el = document.elementFromPoint(
                          touch.clientX,
                          touch.clientY
                        ) as HTMLElement | null;
                        const row = el?.closest(
                          "[data-section-tab-id]"
                        ) as HTMLElement | null;
                        const targetId = row?.dataset.sectionTabId as
                          | ProjectNavTabId
                          | undefined;
                        if (targetId && targetId !== draggedSectionTabId) {
                          e.preventDefault();
                          if (dragOverSectionTabId !== targetId) {
                            setDragOverSectionTabId(targetId);
                          }
                        }
                      }}
                      onTouchEnd={() => {
                        if (draggedSectionTabId && dragOverSectionTabId) {
                          moveSectionBefore(
                            draggedSectionTabId,
                            dragOverSectionTabId
                          );
                        }
                        setDraggedSectionTabId(null);
                        setDragOverSectionTabId(null);
                      }}
                      onTouchCancel={() => {
                        setDraggedSectionTabId(null);
                        setDragOverSectionTabId(null);
                      }}
                      onDragEnd={() => {
                        setDraggedSectionTabId(null);
                        setDragOverSectionTabId(null);
                      }}
                    >
                      <Link
                        href={href}
                        prefetch={false}
                        onClick={closeDrawerOnMobile}
                        className={`drawer-nav-item ${activeTab === tabId ? "is-selected" : ""}`}
                      >
                        {label}
                      </Link>
                    </div>
                  ))}
                </nav>
              </div>
            </>
          ) : (
            <DrawerCollapsedNav
              activeTab={activeTab}
              onExpand={() => setDrawerOpen(true)}
            />
          )}
        </aside>

        <main className="main-content">
          <ProjectNavBar
            projectName={projectName}
            projectId={projectId}
            activeTab={activeTab}
            searchPlaceholder={searchPlaceholder}
            onAddClick={onAddClick}
            onOpenDrawer={() => setDrawerOpen((o) => !o)}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              closeDrawerOnMobile();
            }}
            onCreateProject={
              onCreateProject ??
              ((name) => {
                void router.push(
                  "/?createProject=1&projectName=" + encodeURIComponent(name)
                );
              })
            }
            onDeleteProjectClick={() => {
              const current = projects.find((p) => p.id === selectedProjectId);
              if (current) setProjectToDelete(current);
            }}
            onDeleteAllIssuesClick={onDeleteAllIssuesClick}
            deleteAllIssuesDisabled={deleteAllIssuesDisabled}
          />

          {projectToDelete && (
            <DeleteProjectModal
              project={projectToDelete}
              deleting={projectDeleting}
              onClose={() => setProjectToDelete(null)}
              onConfirm={handleDeleteProject}
            />
          )}

          {children}
        </main>
      </div>
    </>
  );
}
