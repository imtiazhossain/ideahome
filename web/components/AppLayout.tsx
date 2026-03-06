import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  addCustomList,
  getCustomListTabId,
  getCustomLists,
} from "../lib/customLists";
import {
  AUTH_CHANGE_EVENT,
  BACKEND_CONNECTIVITY_CHANGE_EVENT,
  isBackendOffline,
} from "../lib/api/auth";
import { useProjectOrder } from "../lib/useProjectOrder";
import { useAssistantSettings } from "../lib/useAssistantSettings";
import { AppDrawer } from "./AppDrawer";
import { BulbyChatbox } from "./BulbyChatbox";
import { DeleteProjectModal } from "./DeleteProjectModal";
import { ProjectNavBar, useIsMobile, useTabOrder } from "./ProjectNavBar";
import { IconBrokenBulb } from "./icons/IconBrokenBulb";
import type { ProjectNavTabId } from "./ProjectNavBar";

const SECTION_LINKS: {
  href?: string;
  label: string;
  tabId: ProjectNavTabId;
}[] = [
  { tabId: "todo", label: "To-Do", href: "/todo" },
  { tabId: "ideas", label: "Ideas", href: "/ideas" },
  { tabId: "enhancements", label: "Enhancements", href: "/enhancements" },
  { tabId: "summary", label: "Summary", href: "/summary" },
  { tabId: "timeline", label: "Timeline" },
  { tabId: "board", label: "Dashboard", href: "/" },
  { tabId: "tests", label: "Tests", href: "/tests" },
  { tabId: "calendar", label: "Calendar", href: "/calendar" },
  { tabId: "list", label: "Features", href: "/features" },
  { tabId: "forms", label: "Bugs", href: "/bugs" },
  { tabId: "goals", label: "Goals" },
  { tabId: "expenses", label: "Finances", href: "/finances" },
  { tabId: "code", label: "Code", href: "/code" },
  { tabId: "pages", label: "Pages", href: "/pages" },
  { tabId: "settings", label: "Settings", href: "/settings" },
];

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
  handleDeleteProject: (
    project?: { id: string; name: string } | null
  ) => Promise<void>;
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
  /** Pass through to ProjectNavBar */
  onRenameProject?: (projectId: string, name: string) => Promise<void> | void;
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
  onRenameProject,
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
  const isMobile = useIsMobile();
  const drawerSettingsRef = React.useRef<HTMLDivElement>(null);
  const [drawerSettingsOpen, setDrawerSettingsOpen] = React.useState(false);
  const [drawerFiltersOpen, setDrawerFiltersOpen] = React.useState(false);
  const [drawerVoicesOpen, setDrawerVoicesOpen] = React.useState(false);
  const [drawerDeleteSectionsOpen, setDrawerDeleteSectionsOpen] =
    React.useState(false);
  const [creatingProject, setCreatingProject] = React.useState(false);
  const [creatingProjectName, setCreatingProjectName] = React.useState("");
  const [creatingSection, setCreatingSection] = React.useState(false);
  const [creatingSectionName, setCreatingSectionName] = React.useState("");
  const [customLists, setCustomLists] = React.useState<
    ReturnType<typeof getCustomLists>
  >([]);
  const [backendOffline, setBackendOffline] = React.useState(false);
  const creatingProjectInputRef = React.useRef<HTMLInputElement>(null);
  const creatingSectionInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const syncCustomLists = () => setCustomLists(getCustomLists());
    syncCustomLists();
    window.addEventListener("storage", syncCustomLists);
    window.addEventListener(AUTH_CHANGE_EVENT, syncCustomLists);
    return () => {
      window.removeEventListener("storage", syncCustomLists);
      window.removeEventListener(AUTH_CHANGE_EVENT, syncCustomLists);
    };
  }, []);

  React.useEffect(() => {
    setBackendOffline(isBackendOffline());
    const onBackendConnectivityChange = (event: Event) => {
      const detail = (event as CustomEvent<{ offline?: unknown }>).detail;
      if (typeof detail?.offline === "boolean") {
        setBackendOffline(detail.offline);
        return;
      }
      setBackendOffline(isBackendOffline());
    };
    window.addEventListener(
      BACKEND_CONNECTIVITY_CHANGE_EVENT,
      onBackendConnectivityChange
    );
    return () => {
      window.removeEventListener(
        BACKEND_CONNECTIVITY_CHANGE_EVENT,
        onBackendConnectivityChange
      );
    };
  }, []);

  const { orderedProjects, moveProject } = useProjectOrder(projects);

  const {
    availableVoices,
    selectedVoiceUri,
    setSelectedVoiceUri,
    selectedVoiceLabel,
    openRouterModelOptions,
    selectedAiModel,
    setSelectedAiModel,
    canManageOpenRouterModel,
  } = useAssistantSettings();
  const orderedNavLinks = React.useMemo(() => {
    const byId = new Map(SECTION_LINKS.map((l) => [l.tabId, l]));
    const customById = new Map<
      string,
      ReturnType<typeof getCustomLists>[number]
    >(customLists.map((l) => [getCustomListTabId(l.slug), l]));
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
  }, [customLists, tabOrder]);

  const visibleOrderedNavLinks = React.useMemo(
    () =>
      orderedNavLinks
        .filter((link) => tabOrder.includes(link.tabId))
        .filter((link) => !hiddenTabIds.includes(link.tabId))
        .filter((link) => !(isMobile && link.tabId === "code")),
    [hiddenTabIds, isMobile, orderedNavLinks, tabOrder]
  );
  const drawerOrderedNavLinks = React.useMemo(
    () =>
      orderedNavLinks
        .filter((link) => tabOrder.includes(link.tabId))
        .filter((link) => !(isMobile && link.tabId === "code")),
    [isMobile, orderedNavLinks, tabOrder]
  );
  const sortedFilterSections = React.useMemo(
    () =>
      [...orderedNavLinks]
        .map((section) => ({
          ...section,
          visible:
            tabOrder.includes(section.tabId) &&
            !hiddenTabIds.includes(section.tabId),
        }))
        .sort((a, b) => {
          if (a.visible !== b.visible) return a.visible ? -1 : 1;
          return a.label.localeCompare(b.label, undefined, {
            sensitivity: "base",
          });
        }),
    [hiddenTabIds, orderedNavLinks, tabOrder]
  );
  const drawerSortedFilterSections = React.useMemo(
    () => sortedFilterSections.filter((s) => !(isMobile && s.tabId === "code")),
    [isMobile, sortedFilterSections]
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

  const toggleTabVisibility = React.useCallback(
    (tabId: ProjectNavTabId, visible: boolean) => {
      if (visible) {
        if (!hiddenTabIds.includes(tabId)) {
          setHiddenTabIds([...hiddenTabIds, tabId]);
        }
        return;
      }

      const nextHidden = hiddenTabIds.filter((id) => id !== tabId);
      if (nextHidden.length !== hiddenTabIds.length) {
        setHiddenTabIds(nextHidden);
      }
      if (!tabOrder.includes(tabId)) {
        setTabOrder([...tabOrder, tabId]);
      }
      if (deletedTabIds.includes(tabId)) {
        setDeletedTabIds(deletedTabIds.filter((id) => id !== tabId));
      }
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
        router.push(
          "/?createProject=1&projectName=" + encodeURIComponent(nextName)
        ));
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
    setCustomLists((prev) => [
      ...prev.filter((entry) => entry.slug !== list.slug),
      list,
    ]);
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
    setDrawerOpen(false);
  }, [setDrawerOpen]);

  React.useEffect(() => {
    if (!drawerOpen) {
      setDrawerSettingsOpen(false);
      setDrawerFiltersOpen(false);
      setDrawerVoicesOpen(false);
      setDrawerDeleteSectionsOpen(false);
    }
  }, [drawerOpen]);

  React.useEffect(() => {
    if (
      !drawerSettingsOpen &&
      !drawerFiltersOpen &&
      !drawerVoicesOpen &&
      !drawerDeleteSectionsOpen
    )
      return;
    const onOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (drawerSettingsRef.current?.contains(target)) return;
      setDrawerSettingsOpen(false);
      setDrawerFiltersOpen(false);
      setDrawerVoicesOpen(false);
      setDrawerDeleteSectionsOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [
    drawerDeleteSectionsOpen,
    drawerFiltersOpen,
    drawerVoicesOpen,
    drawerSettingsOpen,
  ]);

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
        <AppDrawer
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
          activeTab={activeTab}
          orderedProjects={orderedProjects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          editingProjectId={editingProjectId}
          setEditingProjectId={setEditingProjectId}
          editingProjectName={editingProjectName}
          setEditingProjectName={setEditingProjectName}
          saveProjectName={saveProjectName}
          cancelEditProjectName={cancelEditProjectName}
          projectNameInputRef={projectNameInputRef}
          showDeletePerProject={showDeletePerProject}
          handleDeleteProject={handleDeleteProject}
          projectDeleting={projectDeleting}
          moveProject={moveProject}
          visibleOrderedNavLinks={visibleOrderedNavLinks}
          moveNavTab={moveNavTab}
          onAddProject={handleAddProject}
          onAddTab={handleAddTab}
          closeDrawerOnMobile={closeDrawerOnMobile}
          creatingProject={creatingProject}
          creatingProjectName={creatingProjectName}
          setCreatingProjectName={setCreatingProjectName}
          creatingProjectInputRef={creatingProjectInputRef}
          submitNewProject={submitNewProject}
          onCancelCreatingProject={() => {
            setCreatingProject(false);
            setCreatingProjectName("");
          }}
          creatingSection={creatingSection}
          creatingSectionName={creatingSectionName}
          setCreatingSectionName={setCreatingSectionName}
          creatingSectionInputRef={creatingSectionInputRef}
          submitNewSection={submitNewSection}
          onCancelCreatingSection={() => {
            setCreatingSection(false);
            setCreatingSectionName("");
          }}
          drawerSettingsRef={drawerSettingsRef}
          drawerSettingsOpen={drawerSettingsOpen}
          setDrawerSettingsOpen={setDrawerSettingsOpen}
          drawerFiltersOpen={drawerFiltersOpen}
          setDrawerFiltersOpen={setDrawerFiltersOpen}
          drawerVoicesOpen={drawerVoicesOpen}
          setDrawerVoicesOpen={setDrawerVoicesOpen}
          drawerDeleteSectionsOpen={drawerDeleteSectionsOpen}
          setDrawerDeleteSectionsOpen={setDrawerDeleteSectionsOpen}
          sortedFilterSections={drawerSortedFilterSections}
          onToggleTabVisibility={toggleTabVisibility}
          availableVoices={availableVoices}
          selectedVoiceUri={selectedVoiceUri}
          setSelectedVoiceUri={setSelectedVoiceUri}
          selectedVoiceLabel={selectedVoiceLabel}
          openRouterModelOptions={openRouterModelOptions}
          selectedAiModel={selectedAiModel}
          setSelectedAiModel={setSelectedAiModel}
          canManageOpenRouterModel={canManageOpenRouterModel}
          orderedNavLinks={drawerOrderedNavLinks}
          tabOrderLength={tabOrder.length}
          deleteSectionTab={deleteSectionTab}
          onOpenAppearanceSettings={() => {
            void router.push("/settings");
          }}
        />

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
            onRenameProject={onRenameProject}
            onOpenAppearanceSettings={() => {
              void router.push("/settings");
            }}
          />

          <div className="main-page-scroll">
            {backendOffline ? (
              <section
                className="app-offline-state"
                role="status"
                aria-live="polite"
              >
                <IconBrokenBulb className="app-offline-state-icon" />
                <p className="app-offline-state-title">
                  Looks like the lights went out, we&apos;re going to turn them
                  on right away.
                </p>
              </section>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
      {!backendOffline ? (
        <BulbyChatbox
          projectId={selectedProjectId || orderedProjects[0]?.id || ""}
          projects={orderedProjects}
          onSwitchProject={setSelectedProjectId}
        />
      ) : null}
      {projectToDelete ? (
        <DeleteProjectModal
          project={projectToDelete}
          deleting={projectDeleting}
          onClose={() => setProjectToDelete(null)}
          onConfirm={() => handleDeleteProject(projectToDelete)}
        />
      ) : null}
    </>
  );
}
