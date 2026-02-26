import React from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { getUserScopedStorageKey } from "../lib/api";
import {
  addCustomList,
  getCustomListTabId,
  getCustomLists,
} from "../lib/customLists";
import { DeleteProjectModal } from "./DeleteProjectModal";
import { IconTrash } from "./IconTrash";
import { IconFilter } from "./icons";
import {
  ProjectNavBar,
  DrawerCollapsedNav,
  useTabOrder,
} from "./ProjectNavBar";
import type { ProjectNavTabId } from "./ProjectNavBar";

const SECTION_LINKS: { href?: string; label: string; tabId: ProjectNavTabId }[] = [
  { tabId: "todo", label: "To-Do", href: "/todo" },
  { tabId: "ideas", label: "Ideas", href: "/ideas" },
  { tabId: "enhancements", label: "Enhancements", href: "/enhancements" },
  { tabId: "summary", label: "Summary" },
  { tabId: "timeline", label: "Timeline" },
  { tabId: "board", label: "Dashboard", href: "/" },
  { tabId: "tests", label: "Tests", href: "/tests" },
  { tabId: "calendar", label: "Calendar" },
  { tabId: "list", label: "Features", href: "/features" },
  { tabId: "forms", label: "Bugs", href: "/bugs" },
  { tabId: "goals", label: "Goals" },
  { tabId: "development", label: "Code Health", href: "/coverage" },
  { tabId: "expenses", label: "Expenses", href: "/expenses" },
  { tabId: "code", label: "Code" },
  { tabId: "pages", label: "Pages" },
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
  const {
    tabOrder,
    setTabOrder,
    hiddenTabIds,
    setHiddenTabIds,
    deletedTabIds,
    setDeletedTabIds,
  } = useTabOrder();
  const drawerSettingsRef = React.useRef<HTMLDivElement>(null);
  const [drawerSettingsOpen, setDrawerSettingsOpen] = React.useState(false);
  const [drawerFiltersOpen, setDrawerFiltersOpen] = React.useState(false);
  const [drawerDeleteSectionsOpen, setDrawerDeleteSectionsOpen] =
    React.useState(false);
  const [projectOrderIds, setProjectOrderIds] = React.useState<string[]>([]);
  const [creatingProject, setCreatingProject] = React.useState(false);
  const [creatingProjectName, setCreatingProjectName] = React.useState("");
  const [creatingSection, setCreatingSection] = React.useState(false);
  const [creatingSectionName, setCreatingSectionName] = React.useState("");
  const creatingProjectInputRef = React.useRef<HTMLInputElement>(null);
  const creatingSectionInputRef = React.useRef<HTMLInputElement>(null);

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
  const orderedNavLinks = React.useMemo(() => {
    const byId = new Map(SECTION_LINKS.map((l) => [l.tabId, l]));
    const customById = new Map<string, (ReturnType<typeof getCustomLists>[number])>(
      getCustomLists().map((l) => [getCustomListTabId(l.slug), l])
    );
    const ordered = tabOrder
      .map((id) => {
        const builtIn = byId.get(id);
        if (builtIn) return builtIn;
        const custom = customById.get(id);
        if (!custom) return null;
        return {
          href: `/list/${custom.slug}`,
          label: custom.name,
          tabId: id,
        };
      })
      .filter(
        (
          link
        ): link is { href?: string; label: string; tabId: ProjectNavTabId } =>
          Boolean(link)
      );
    const missing = SECTION_LINKS.filter(
      (link) => !ordered.some((item) => item.tabId === link.tabId)
    );
    return [...ordered, ...missing];
  }, [tabOrder]);

  const visibleOrderedNavLinks = React.useMemo(
    () => orderedNavLinks.filter((link) => !hiddenTabIds.includes(link.tabId)),
    [hiddenTabIds, orderedNavLinks]
  );
  const sortedFilterSections = React.useMemo(
    () =>
      [...orderedNavLinks]
        .map((section) => ({
          ...section,
          visible: !hiddenTabIds.includes(section.tabId),
        }))
        .sort((a, b) => {
          if (a.visible !== b.visible) return a.visible ? -1 : 1;
          return a.label.localeCompare(b.label, undefined, {
            sensitivity: "base",
          });
        }),
    [hiddenTabIds, orderedNavLinks]
  );

  const moveNavTab = React.useCallback(
    (tabId: ProjectNavTabId, direction: "up" | "down") => {
      const navTabIds = visibleOrderedNavLinks.map((l) => l.tabId);
      const fromVisible = navTabIds.indexOf(tabId);
      if (fromVisible === -1) return;
      const toVisible = direction === "up" ? fromVisible - 1 : fromVisible + 1;
      if (toVisible < 0 || toVisible >= navTabIds.length) return;
      const swapId = navTabIds[toVisible];
      const from = tabOrder.indexOf(tabId);
      const to = tabOrder.indexOf(swapId);
      if (from === -1 || to === -1) return;
      const next = [...tabOrder];
      [next[from], next[to]] = [next[to], next[from]];
      setTabOrder(next);
    },
    [setTabOrder, tabOrder, visibleOrderedNavLinks]
  );

  const deleteSectionTab = React.useCallback(
    (tabId: ProjectNavTabId) => {
      if (tabOrder.length <= 1) return;
      const nextOrder = tabOrder.filter((id) => id !== tabId);
      if (nextOrder.length === 0) return;
      setTabOrder(nextOrder);
      setHiddenTabIds(hiddenTabIds.filter((id) => id !== tabId));
      setDeletedTabIds(Array.from(new Set([...deletedTabIds, tabId])));
    },
    [
      deletedTabIds,
      hiddenTabIds,
      setDeletedTabIds,
      setHiddenTabIds,
      setTabOrder,
      tabOrder,
    ]
  );

  const submitNewProject = React.useCallback(async () => {
    const name = creatingProjectName.trim();
    if (!name) {
      setCreatingProject(false);
      setCreatingProjectName("");
      return;
    }
    const createProject =
      onCreateProject ??
      ((nextName: string) =>
        router.push("/?createProject=1&projectName=" + encodeURIComponent(nextName)));
    await Promise.resolve(createProject(name));
    setCreatingProject(false);
    setCreatingProjectName("");
  }, [creatingProjectName, onCreateProject, router]);

  const submitNewSection = React.useCallback(() => {
    const name = creatingSectionName.trim();
    if (!name) {
      setCreatingSection(false);
      setCreatingSectionName("");
      return;
    }
    const list = addCustomList(name);
    const id = getCustomListTabId(list.slug);
    if (!tabOrder.includes(id)) {
      setTabOrder([...tabOrder, id]);
    }
    setCreatingSection(false);
    setCreatingSectionName("");
    void router.push(`/list/${list.slug}`);
  }, [creatingSectionName, router, setTabOrder, tabOrder]);

  const handleAddProject = React.useCallback(() => {
    setCreatingProject(true);
    setCreatingProjectName("");
    setEditingProjectId(null);
  }, [setEditingProjectId]);

  const handleAddTab = React.useCallback(() => {
    setCreatingSection(true);
    setCreatingSectionName("");
  }, []);

  const closeDrawerOnMobile = React.useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches
    ) {
      setDrawerOpen(false);
    }
  }, [setDrawerOpen]);

  React.useEffect(() => {
    if (!drawerOpen) {
      setDrawerSettingsOpen(false);
      setDrawerFiltersOpen(false);
      setDrawerDeleteSectionsOpen(false);
    }
  }, [drawerOpen]);

  React.useEffect(() => {
    if (!drawerSettingsOpen && !drawerFiltersOpen && !drawerDeleteSectionsOpen)
      return;
    const onOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (drawerSettingsRef.current?.contains(target)) return;
      setDrawerSettingsOpen(false);
      setDrawerFiltersOpen(false);
      setDrawerDeleteSectionsOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [drawerDeleteSectionsOpen, drawerFiltersOpen, drawerSettingsOpen]);

  React.useEffect(() => {
    if (creatingProject) creatingProjectInputRef.current?.focus();
  }, [creatingProject]);

  React.useEffect(() => {
    if (creatingSection) creatingSectionInputRef.current?.focus();
  }, [creatingSection]);

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
      <div className={`app-layout${drawerOpen ? " is-drawer-open" : ""}`}>
        <aside
          className={`drawer ${drawerOpen ? "drawer-open" : "drawer-closed"}`}
        >
          {drawerOpen ? (
            <>
              <div className="drawer-logo" aria-hidden>
                <svg
                  className="drawer-logo-mark"
                  viewBox="0 0 24 24"
                  role="img"
                  aria-hidden="true"
                >
                  <path
                    d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.2a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1V20H5a1 1 0 0 1-1-1z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18.5 5.2v1.6M17.7 6h1.6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
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
                  <div className="drawer-nav-label-row">
                    <div className="drawer-nav-label">Projects</div>
                    <button
                      type="button"
                      className="drawer-nav-label-add-btn"
                      onClick={handleAddProject}
                      aria-label="Add project"
                      title="Add project"
                    >
                      +
                    </button>
                  </div>
                  {creatingProject && (
                    <div className="drawer-nav-item-row">
                      <input
                        ref={creatingProjectInputRef}
                        type="text"
                        className="drawer-nav-item drawer-nav-item-input"
                        value={creatingProjectName}
                        onChange={(e) => setCreatingProjectName(e.target.value)}
                        onBlur={() => {
                          void submitNewProject();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void submitNewProject();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setCreatingProject(false);
                            setCreatingProjectName("");
                          }
                        }}
                        placeholder="Project Name?"
                        aria-label="Project Name"
                      />
                    </div>
                  )}
                  {orderedProjects.map((p) => (
                    <div key={p.id} className="drawer-nav-item-row">
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
                      {editingProjectId !== p.id && (
                        <span className="drawer-nav-row-actions">
                          <button
                            type="button"
                            className="drawer-nav-item-reorder"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              moveProject(p.id, "up");
                            }}
                            aria-label={`Move ${p.name} up`}
                            title="Move up"
                            disabled={orderedProjects[0]?.id === p.id}
                          >
                            ▲
                          </button>
                        </span>
                      )}
                      {(showDeletePerProject || editingProjectId === p.id) && (
                        <button
                          type="button"
                          className={`drawer-nav-item-delete${showDeletePerProject || editingProjectId === p.id ? " is-visible" : ""}`}
                          onClick={(e) => {
                            e.preventDefault();
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
                  <div className="drawer-nav-label-row drawer-nav-label-row-sections">
                    <div className="drawer-nav-label">Sections</div>
                    <button
                      type="button"
                      className="drawer-nav-label-add-btn"
                      onClick={handleAddTab}
                      aria-label="Add tab"
                      title="Add tab"
                    >
                      +
                    </button>
                  </div>
                  {creatingSection && (
                    <div className="drawer-nav-section-row">
                      <input
                        ref={creatingSectionInputRef}
                        type="text"
                        className="drawer-nav-item drawer-nav-item-input"
                        value={creatingSectionName}
                        onChange={(e) => setCreatingSectionName(e.target.value)}
                        onBlur={submitNewSection}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitNewSection();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setCreatingSection(false);
                            setCreatingSectionName("");
                          }
                        }}
                        placeholder="Section Name?"
                        aria-label="Section Name"
                      />
                    </div>
                  )}
                  {visibleOrderedNavLinks.map(({ href, label, tabId }) => (
                    <div key={tabId} className="drawer-nav-section-row">
                      {href ? (
                        <Link
                          href={href}
                          prefetch={false}
                          onClick={closeDrawerOnMobile}
                          className={`drawer-nav-item ${activeTab === tabId ? "is-selected" : ""}`}
                        >
                          {label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className={`drawer-nav-item ${activeTab === tabId ? "is-selected" : ""}`}
                          onClick={() => {}}
                          title={label}
                        >
                          {label}
                        </button>
                      )}
                      <span className="drawer-nav-row-actions">
                        <button
                          type="button"
                          className="drawer-nav-item-reorder"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            moveNavTab(tabId, "up");
                          }}
                          aria-label={`Move ${label} up`}
                          title="Move up"
                          disabled={visibleOrderedNavLinks[0]?.tabId === tabId}
                        >
                          ▲
                        </button>
                      </span>
                    </div>
                  ))}
                </nav>
              </div>
              <div className="drawer-bottom-settings" ref={drawerSettingsRef}>
                {drawerFiltersOpen && (
                  <div className="drawer-bottom-filter-menu">
                    {sortedFilterSections.map(({ tabId, label, visible }) => (
                      <label key={tabId} className="drawer-bottom-filter-item">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => {
                            const next = visible
                              ? [...hiddenTabIds, tabId]
                              : hiddenTabIds.filter((id) => id !== tabId);
                            setHiddenTabIds(next);
                          }}
                          aria-label={`${visible ? "Hide" : "Show"} ${label}`}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                )}
                {drawerDeleteSectionsOpen && (
                  <div className="drawer-bottom-delete-sections-menu">
                    {orderedNavLinks.map(({ tabId, label }) => {
                      const canDelete = tabOrder.length > 1;
                      return (
                        <div key={tabId} className="drawer-bottom-delete-row">
                          <span>{label}</span>
                          <button
                            type="button"
                            className="drawer-bottom-delete-btn"
                            onClick={() => deleteSectionTab(tabId)}
                            aria-label={`Delete ${label}`}
                            title={
                              canDelete
                                ? `Delete ${label}`
                                : "At least one section must remain"
                            }
                            disabled={!canDelete}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {drawerSettingsOpen && (
                  <div className="drawer-bottom-settings-menu" role="menu">
                    <button
                      type="button"
                      className="drawer-bottom-settings-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setDrawerFiltersOpen((open) => !open);
                        setDrawerDeleteSectionsOpen(false);
                      }}
                      aria-label="Manage tabs"
                      title="Manage tabs"
                    >
                      <IconFilter />
                    </button>
                    <button
                      type="button"
                      className="drawer-bottom-settings-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setDrawerDeleteSectionsOpen((open) => !open);
                        setDrawerFiltersOpen(false);
                      }}
                      aria-label="Delete sections"
                      title="Delete sections"
                    >
                      <IconTrash />
                    </button>
                    <button
                      type="button"
                      className="drawer-bottom-settings-menu-item"
                      role="menuitem"
                      onClick={() => {
                        toggleTheme();
                        setDrawerSettingsOpen(false);
                        setDrawerFiltersOpen(false);
                        setDrawerDeleteSectionsOpen(false);
                      }}
                      aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                      title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                    >
                      {theme === "light" ? "☀" : "🌙"}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="drawer-bottom-settings-btn"
                  onClick={() => {
                    setDrawerSettingsOpen((open) => {
                      const next = !open;
                      if (!next) {
                        setDrawerFiltersOpen(false);
                        setDrawerDeleteSectionsOpen(false);
                      }
                      return next;
                    });
                  }}
                  aria-label="Settings"
                  title="Settings"
                >
                  ⚙
                </button>
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
