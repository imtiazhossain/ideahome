import React from "react";
import { toUiTitleCase } from "@ideahome/shared";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  BACKEND_CONNECTIVITY_CHANGE_EVENT,
  isBackendOffline,
} from "../lib/api/auth";
import { addCustomTab, getCustomTabHref, getCustomTabId } from "../lib/customTabs";
import { useCustomTabs } from "../lib/useCustomTabs";
import { useProjectOrder } from "../lib/useProjectOrder";
import { useAssistantSettings } from "../lib/useAssistantSettings";
import { AppDrawer } from "./AppDrawer";
import { BulbyChatbox } from "./BulbyChatbox";
import { RESERVED_CUSTOM_TAB_ICON_IDS } from "./CustomTabIcon";
import { CreateCustomTabModal } from "./CreateCustomTabModal";
import { DeleteProjectModal } from "./DeleteProjectModal";
import { ProjectNavBar, useIsMobile, useTabOrder } from "./ProjectNavBar";
import { IconBrokenBulb } from "./icons/IconBrokenBulb";
import type { ProjectNavTabId } from "./ProjectNavBar";

const SECTION_LINKS: {
  href?: string;
  label: string;
  tabId: ProjectNavTabId;
}[] = [
  { tabId: "todo", label: toUiTitleCase("to-do"), href: "/todo" },
  { tabId: "ideas", label: toUiTitleCase("ideas"), href: "/ideas" },
  {
    tabId: "enhancements",
    label: toUiTitleCase("enhancements"),
    href: "/enhancements",
  },
  { tabId: "summary", label: toUiTitleCase("summary"), href: "/summary" },
  { tabId: "timeline", label: toUiTitleCase("timeline"), href: "/timeline" },
  { tabId: "board", label: toUiTitleCase("dashboard"), href: "/" },
  { tabId: "tests", label: toUiTitleCase("tests"), href: "/tests" },
  { tabId: "calendar", label: toUiTitleCase("calendar"), href: "/calendar" },
  { tabId: "list", label: toUiTitleCase("features"), href: "/features" },
  { tabId: "forms", label: toUiTitleCase("bugs"), href: "/bugs" },
  { tabId: "goals", label: toUiTitleCase("goals"), href: "/goals" },
  { tabId: "expenses", label: toUiTitleCase("finances"), href: "/finances" },
  { tabId: "code", label: toUiTitleCase("code"), href: "/code" },
  { tabId: "pages", label: toUiTitleCase("pages"), href: "/pages" },
  { tabId: "settings", label: toUiTitleCase("settings"), href: "/settings" },
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
  const [createCustomTabModalOpen, setCreateCustomTabModalOpen] =
    React.useState(false);
  const [backendOffline, setBackendOffline] = React.useState(false);
  const creatingProjectInputRef = React.useRef<HTMLInputElement>(null);
  const customTabs = useCustomTabs(selectedProjectId);
  const usedCustomIconIds = React.useMemo(
    () =>
      customTabs
        .map((tab) => (tab.icon.type === "preset" ? tab.icon.presetId : null))
        .filter((iconId): iconId is string => Boolean(iconId))
        .filter((iconId) => !RESERVED_CUSTOM_TAB_ICON_IDS.includes(iconId as never)),
    [customTabs]
  );

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
    const customById = new Map<string, (typeof customTabs)[number]>(
      customTabs.map((entry) => [getCustomTabId(entry.slug), entry] as const)
    );
    const ordered = tabOrder
      .map((id) => {
        const builtIn = byId.get(id);
        if (builtIn) return builtIn;
        const custom = customById.get(id);
        if (!custom) return null;
        return {
          href: getCustomTabHref(custom),
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
  }, [customTabs, tabOrder]);

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

  const handleAddProject = React.useCallback(() => {
    setCreatingProject(true);
    setCreatingProjectName("");
    setEditingProjectId(null);
  }, [setEditingProjectId]);

  const handleAddTab = React.useCallback(() => {
    setCreateCustomTabModalOpen(true);
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
            onOpenCreateTabModal={() => {
              setCreateCustomTabModalOpen(true);
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
      <CreateCustomTabModal
        open={createCustomTabModalOpen}
        onClose={() => setCreateCustomTabModalOpen(false)}
        usedIconIds={usedCustomIconIds}
        onSubmit={async ({ name, kind, icon }) => {
          if (!selectedProjectId) {
            throw new Error("Select a project before creating a custom tab.");
          }
          const customTab = addCustomTab(selectedProjectId, {
            name,
            kind,
            icon,
          });
          const tabId = getCustomTabId(customTab.slug);
          if (!tabOrder.includes(tabId)) {
            setTabOrder([...tabOrder, tabId]);
          }
          setHiddenTabIds(hiddenTabIds.filter((id) => id !== tabId));
          setDeletedTabIds(deletedTabIds.filter((id) => id !== tabId));
          setCreateCustomTabModalOpen(false);
          await router.push(getCustomTabHref(customTab));
        }}
      />
    </>
  );
}
