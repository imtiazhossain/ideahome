import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { AUTH_CHANGE_EVENT, getStoredToken } from "../lib/api/auth";
import { logout } from "../lib/api/session";
import {
  addCustomList,
  getCustomListTabId,
  getCustomLists,
} from "../lib/customLists";
import {
  IconChevronDown,
  IconHomeBulby,
  IconLogin,
  IconLogout,
  IconProfile,
} from "./icons";
import { AccessibleModal } from "./AccessibleModal";
import { ErrorBanner } from "./ErrorBanner";
import { IconFromName } from "./IconFromName";
import { IconPlus } from "./IconPlus";
import {
  getCompactTabLabel,
  getSettingsButtonVisibleStorageKey,
} from "./project-nav/utils";
import { ProjectSettingsModal } from "./ProjectSettingsModal";
import { ProjectNavSearch } from "./project-nav/ProjectNavSearch";
import { ProjectNavSettingsMenu } from "./project-nav/ProjectNavSettingsMenu";
import { useProjectNavSettings } from "./project-nav/useProjectNavSettings";
import {
  DrawerCollapsedNav,
  EXPLICIT_BOARD_SESSION_KEY,
  getFirstVisibleTabHref,
  loadTabOrder,
  OPEN_SETTINGS_MENU_EVENT,
  TABS,
  TabOrderProvider,
  useIsMobile,
  useTabOrder,
  type ProjectNavTabId,
} from "./project-nav/tab-order";

export {
  DrawerCollapsedNav,
  EXPLICIT_BOARD_SESSION_KEY,
  getFirstVisibleTabHref,
  OPEN_SETTINGS_MENU_EVENT,
  TabOrderProvider,
  useIsMobile,
  useTabOrder,
};
export type { ProjectNavTabId };

export interface ProjectNavBarProps {
  projectName: string;
  /** When set, the search box searches across the project (issues, etc.) and shows a dropdown. */
  projectId?: string;
  activeTab?: ProjectNavTabId;
  onTabChange?: (tab: ProjectNavTabId) => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onAddClick?: () => void;
  /** Called when user taps the mobile menu button to open the sidebar. */
  onOpenDrawer?: () => void;
  /** When provided, the project name becomes clickable and shows a switcher dropdown. */
  projects?: { id: string; name: string }[];
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
  /** Called when user submits a project name from the inline create form. Only called with non-empty name. */
  onCreateProject?: (name: string) => void | Promise<void>;
  /** Called when user clicks "Delete the Project" in settings. Opens delete modal in parent. */
  onDeleteProjectClick?: () => void;
  /** Called when user clicks "Delete all issues" in settings. Board page only. */
  onDeleteAllIssuesClick?: () => void;
  /** When onDeleteAllIssuesClick is provided, whether delete-all is disabled (e.g. loading or no issues). */
  deleteAllIssuesDisabled?: boolean;
  /** Called when user saves a project name from the project settings modal. */
  onRenameProject?: (projectId: string, name: string) => Promise<void> | void;
  /** When false, hides the settings button. Default true. */
  showSettingsButton?: boolean;
  /** Open global appearance settings page. */
  onOpenAppearanceSettings?: () => void;
}

interface ProjectNavAuthMenuProps {
  hasToken: boolean | null;
  authMenuOpen: boolean;
  setAuthMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}

function ProjectNavAuthMenu({
  hasToken,
  authMenuOpen,
  setAuthMenuOpen,
}: ProjectNavAuthMenuProps) {
  const authMenuRef = useRef<HTMLSpanElement | null>(null);

  const handleLogout = useCallback(() => {
    setAuthMenuOpen(false);
    logout("/login");
  }, [setAuthMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        authMenuRef.current &&
        !authMenuRef.current.contains(e.target as Node)
      ) {
        setAuthMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setAuthMenuOpen]);

  if (hasToken === null) return null;

  return (
    <span className="project-nav-auth project-nav-auth-wrap" ref={authMenuRef}>
      <button
        type="button"
        className={`project-nav-auth-btn${authMenuOpen ? " is-open" : ""}`}
        onClick={() => setAuthMenuOpen((o) => !o)}
        aria-label={hasToken ? "Account menu" : "Sign in"}
        title={hasToken ? "Account menu" : "Sign in"}
        aria-expanded={authMenuOpen}
        aria-haspopup="true"
      >
        <IconProfile />
      </button>
      {authMenuOpen && (
        <div className="project-nav-auth-menu" role="menu">
          {hasToken ? (
            <button
              type="button"
              className="project-nav-auth-menu-item project-nav-auth-menu-item--icon project-nav-auth-menu-item--logout"
              role="menuitem"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
            >
              <IconLogout />
            </button>
          ) : (
            <Link
              href="/login"
              prefetch={false}
              className="project-nav-auth-menu-item project-nav-auth-menu-item--icon project-nav-auth-menu-item--login"
              role="menuitem"
              onClick={() => setAuthMenuOpen(false)}
              aria-label="Log in"
              title="Log in"
            >
              <IconLogin />
            </Link>
          )}
        </div>
      )}
    </span>
  );
}

function SortableNavTab({
  id,
  enabled,
  children,
}: {
  id: ProjectNavTabId;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !enabled,
  });
  return (
    <span
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`project-nav-tab-sortable${isDragging ? " is-dragging" : ""}`}
      {...(enabled ? attributes : {})}
      {...(enabled ? listeners : {})}
    >
      {children}
    </span>
  );
}

export function ProjectNavBar({
  projectName,
  projectId,
  activeTab = "board",
  onTabChange,
  searchPlaceholder = "Search board",
  searchValue = "",
  onSearchChange,
  onAddClick,
  onOpenDrawer,
  projects,
  selectedProjectId,
  onDeleteProjectClick,
  onDeleteAllIssuesClick,
  deleteAllIssuesDisabled,
  onRenameProject,
  showSettingsButton = true,
  onOpenAppearanceSettings,
}: ProjectNavBarProps) {
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
  const {
    settingsButtonVisible,
    setSettingsButtonVisible,
    settingsMenuOpen,
    setSettingsMenuOpen,
    reorderSectionOpen,
    setReorderSectionOpen,
    showTabsSectionOpen,
    setShowTabsSectionOpen,
    addSectionOpen,
    setAddSectionOpen,
    deleteProjectSectionOpen,
    setDeleteProjectSectionOpen,
    settingsMenuRef,
    closeSettingsMenu,
  } = useProjectNavSettings();
  const [createListModalOpen, setCreateListModalOpen] = useState(false);
  const [createListName, setCreateListName] = useState("");
  const [createListError, setCreateListError] = useState<string | null>(null);
  const [customLists, setCustomLists] = useState<
    ReturnType<typeof getCustomLists>
  >([]);

  useEffect(() => {
    const syncCustomLists = () => setCustomLists(getCustomLists());
    syncCustomLists();
    window.addEventListener("storage", syncCustomLists);
    window.addEventListener(AUTH_CHANGE_EVENT, syncCustomLists);
    return () => {
      window.removeEventListener("storage", syncCustomLists);
      window.removeEventListener(AUTH_CHANGE_EVENT, syncCustomLists);
    };
  }, []);

  const [compactTabs, setCompactTabs] = useState(false);
  const [draggingTabId, setDraggingTabId] = useState<ProjectNavTabId | null>(
    null
  );
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  useEffect(() => {
    setHasToken(!!getStoredToken());
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 640px)");
    const sync = () => setCompactTabs(media.matches);
    sync();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);
  const tabsDragEnabled = !isMobile;
  useEffect(() => {
    const handler = () => setHasToken(!!getStoredToken());
    window.addEventListener(AUTH_CHANGE_EVENT, handler);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, handler);
  }, []);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(getSettingsButtonVisibleStorageKey());
      setSettingsButtonVisible(stored !== "0");
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(e.target as Node)
      ) {
        closeSettingsMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeSettingsMenu]);

  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const suppressTabClickRef = useRef(false);
  const dragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 1024px)").matches) return;
    const container = tabsScrollRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(
      ".project-nav-tab.is-active"
    );
    if (!active) return;
    active.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeTab, tabOrder, hiddenTabIds]);

  useEffect(() => {
    setTabOrder(loadTabOrder(deletedTabIds));
  }, [deletedTabIds, setTabOrder]);

  /** Move tab within the visible-only list (for reorder UI). */
  const moveTabVisible = useCallback(
    (tabId: ProjectNavTabId, direction: "up" | "down") => {
      const hidden = new Set(hiddenTabIds);
      const visibleOrder = tabOrder.filter((id) => !hidden.has(id));
      const visibleIdx = visibleOrder.indexOf(tabId);
      if (visibleIdx === -1) return;
      const swapVisibleIdx =
        direction === "up" ? visibleIdx - 1 : visibleIdx + 1;
      if (swapVisibleIdx < 0 || swapVisibleIdx >= visibleOrder.length) return;
      const swapId = visibleOrder[swapVisibleIdx];
      const idx = tabOrder.indexOf(tabId);
      const swapIdx = tabOrder.indexOf(swapId);
      if (idx === -1 || swapIdx === -1) return;
      const next = [...tabOrder];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      setTabOrder(next);
    },
    [tabOrder, setTabOrder, hiddenTabIds]
  );

  const deleteTab = useCallback(
    (tabId: ProjectNavTabId) => {
      if (tabOrder.length <= 1) return;
      const nextOrder = tabOrder.filter((id) => id !== tabId);
      if (nextOrder.length === 0) return;
      const nextHidden = hiddenTabIds.filter((id) => id !== tabId);
      const nextDeleted = Array.from(new Set([...deletedTabIds, tabId]));
      setTabOrder(nextOrder);
      setHiddenTabIds(nextHidden);
      setDeletedTabIds(nextDeleted);
      if (activeTab === tabId) {
        void router.push(
          getFirstVisibleTabHref(isMobile ? ["code"] : undefined)
        );
      }
    },
    [
      activeTab,
      deletedTabIds,
      hiddenTabIds,
      isMobile,
      router,
      setDeletedTabIds,
      setHiddenTabIds,
      setTabOrder,
      tabOrder,
    ]
  );

  const restoreDeletedTabs = useCallback(() => {
    if (deletedTabIds.length === 0) return;
    setDeletedTabIds([]);
    setTabOrder(loadTabOrder([]));
  }, [deletedTabIds.length, setDeletedTabIds, setTabOrder]);

  const hiddenSet = new Set(hiddenTabIds);
  const orderedTabs = tabOrder
    .filter((id) => !hiddenSet.has(id))
    .map(
      (
        id
      ): {
        id: ProjectNavTabId;
        label: string;
        icon: React.ReactNode;
        href?: string;
        hasDropdown?: boolean;
        desktopOnly?: boolean;
      } | null => {
        const builtIn = TABS.find((t) => t.id === id);
        if (builtIn) return builtIn;
        if (typeof id === "string" && id.startsWith("custom-")) {
          const slug = id.slice(7);
          const list = customLists.find((l) => l.slug === slug);
          if (list)
            return {
              id,
              label: list.name,
              icon: <IconFromName name={list.name} />,
              href: `/list/${list.slug}`,
            };
        }
        return null;
      }
    )
    .filter(Boolean)
    .filter(
      (t): t is NonNullable<typeof t> =>
        t != null && !(isMobile && "desktopOnly" in t && t.desktopOnly)
    ) as {
    id: ProjectNavTabId;
    label: string;
    icon: React.ReactNode;
    href?: string;
    hasDropdown?: boolean;
  }[];

  const getTabLabel = useCallback(
    (tabId: ProjectNavTabId, label: string) => {
      if (!compactTabs) return label;
      if (activeTab === tabId) return label;
      return getCompactTabLabel(tabId, label);
    },
    [activeTab, compactTabs]
  );

  const consumeDraggedClick = useCallback((e: React.MouseEvent<Element>) => {
    if (!suppressTabClickRef.current) return false;
    suppressTabClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
    return true;
  }, []);

  const handleTabsDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!tabsDragEnabled) return;
      setDraggingTabId(event.active.id as ProjectNavTabId);
    },
    [tabsDragEnabled]
  );

  const handleTabsDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingTabId(null);
      if (!tabsDragEnabled) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeId = active.id as ProjectNavTabId;
      const overId = over.id as ProjectNavTabId;
      const from = tabOrder.indexOf(activeId);
      const to = tabOrder.indexOf(overId);
      if (from === -1 || to === -1) return;
      const next = [...tabOrder];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setTabOrder(next);
      suppressTabClickRef.current = true;
      window.setTimeout(() => {
        suppressTabClickRef.current = false;
      }, 180);
    },
    [tabsDragEnabled, tabOrder, setTabOrder]
  );

  const handleTabsDragCancel = useCallback(() => {
    setDraggingTabId(null);
  }, []);

  return (
    <header className="project-nav">
      <div className="project-nav-top">
        <div className="project-nav-identity">
          <div className="project-nav-title-row">
            <button
              type="button"
              className="drawer-toggle drawer-logo project-nav-drawer-toggle"
              onClick={onOpenDrawer}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <span className="drawer-logo-mark" role="img" aria-hidden="true">
                <IconHomeBulby />
              </span>
            </button>
            <h1 className="project-nav-project-name">
              <button
                type="button"
                className="project-nav-project-name-btn"
                onClick={() => setProjectSettingsOpen(true)}
                disabled={!selectedProjectId}
                title={
                  selectedProjectId
                    ? "Open project settings"
                    : "Select a project first"
                }
                aria-label="Open project settings"
              >
                {projectName || "Project"}
              </button>
            </h1>
            <ProjectNavSearch
              projectId={projectId}
              searchPlaceholder={searchPlaceholder}
              searchValue={searchValue}
              onSearchChange={onSearchChange}
              projectSearchOpen={projectSearchOpen}
              setProjectSearchOpen={setProjectSearchOpen}
            />
            {onAddClick && (
              <button
                type="button"
                className="btn btn-primary btn-sm project-nav-create-deck"
                onClick={onAddClick}
                aria-label="Create Deck"
              >
                <IconPlus />
                Create Deck
              </button>
            )}
            <ProjectNavAuthMenu
              hasToken={hasToken}
              authMenuOpen={authMenuOpen}
              setAuthMenuOpen={setAuthMenuOpen}
            />
          </div>
        </div>
      </div>
      <nav
        className={`project-nav-tabs-wrap${draggingTabId ? " is-dragging" : ""}${tabsDragEnabled ? " is-draggable" : ""}`}
        aria-label="Project views"
      >
        <div ref={tabsScrollRef} className="project-nav-tabs-scroll">
          <DndContext
            id="project-nav-tabs-dnd"
            sensors={dragSensors}
            modifiers={[restrictToWindowEdges]}
            collisionDetection={closestCenter}
            onDragStart={tabsDragEnabled ? handleTabsDragStart : undefined}
            onDragEnd={tabsDragEnabled ? handleTabsDragEnd : undefined}
            onDragCancel={tabsDragEnabled ? handleTabsDragCancel : undefined}
          >
            <SortableContext
              items={orderedTabs.map((tab) => tab.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="project-nav-tabs">
                <div className="project-nav-tabs-inner">
                  {orderedTabs.map((tab) => (
                    <SortableNavTab
                      key={tab.id}
                      id={tab.id}
                      enabled={tabsDragEnabled}
                    >
                      {tab.href ? (
                        tab.href === "/" ? (
                          <button
                            type="button"
                            className={`project-nav-tab ${activeTab === tab.id ? "is-active" : ""}`}
                            aria-current={
                              activeTab === tab.id ? "page" : undefined
                            }
                            data-tab-id={tab.id}
                            title={tab.label}
                            onClick={(e) => {
                              if (consumeDraggedClick(e)) return;
                              setProjectSearchOpen(false);
                              closeSettingsMenu();
                              setAuthMenuOpen(false);
                              try {
                                sessionStorage.setItem(
                                  EXPLICIT_BOARD_SESSION_KEY,
                                  "1"
                                );
                              } catch {
                                /* ignore */
                              }
                              if (activeTab === tab.id) {
                                const main =
                                  document.querySelector(".main-content");
                                if (main)
                                  main.scrollTo({ top: 0, behavior: "smooth" });
                              } else {
                                void router.push("/");
                              }
                            }}
                          >
                            <span className="project-nav-tab-icon">
                              {tab.icon}
                            </span>
                            <span className="project-nav-tab-label">
                              {getTabLabel(tab.id, tab.label)}
                            </span>
                          </button>
                        ) : (
                          <Link
                            href={tab.href}
                            prefetch={false}
                            className={`project-nav-tab ${activeTab === tab.id ? "is-active" : ""}`}
                            aria-current={
                              activeTab === tab.id ? "page" : undefined
                            }
                            data-tab-id={tab.id}
                            title={tab.label}
                            onClick={(e) => {
                              if (consumeDraggedClick(e)) return;
                              setProjectSearchOpen(false);
                              closeSettingsMenu();
                              setAuthMenuOpen(false);
                              if (activeTab === tab.id) {
                                const main =
                                  document.querySelector(".main-content");
                                if (main)
                                  main.scrollTo({ top: 0, behavior: "smooth" });
                              }
                            }}
                          >
                            <span className="project-nav-tab-icon">
                              {tab.icon}
                            </span>
                            <span className="project-nav-tab-label">
                              {getTabLabel(tab.id, tab.label)}
                            </span>
                          </Link>
                        )
                      ) : (
                        <button
                          type="button"
                          className={`project-nav-tab ${activeTab === tab.id ? "is-active" : ""}`}
                          onClick={(e) => {
                            if (consumeDraggedClick(e)) return;
                            onTabChange?.(tab.id);
                            if (onTabChange) return;
                            const builtInTab = TABS.find(
                              (entry) => entry.id === tab.id
                            );
                            const href = builtInTab?.href;
                            if (!href) return;
                            if (href === "/") {
                              try {
                                sessionStorage.setItem(
                                  EXPLICIT_BOARD_SESSION_KEY,
                                  "1"
                                );
                              } catch {
                                // ignore
                              }
                            }
                            void router.push(href);
                          }}
                          aria-current={
                            activeTab === tab.id ? "page" : undefined
                          }
                          data-tab-id={tab.id}
                          title={tab.label}
                        >
                          <span className="project-nav-tab-icon">
                            {tab.icon}
                          </span>
                          <span className="project-nav-tab-label">
                            {getTabLabel(tab.id, tab.label)}
                          </span>
                          {tab.hasDropdown && (
                            <span
                              className="project-nav-tab-chevron"
                              aria-hidden
                            >
                              <IconChevronDown />
                            </span>
                          )}
                        </button>
                      )}
                    </SortableNavTab>
                  ))}
                </div>
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <ProjectNavSettingsMenu
          showSettingsButton={showSettingsButton}
          settingsButtonVisible={settingsButtonVisible}
          settingsMenuOpen={settingsMenuOpen}
          setSettingsMenuOpen={setSettingsMenuOpen}
          settingsMenuRef={settingsMenuRef}
          closeSettingsMenu={closeSettingsMenu}
          onDeleteAllIssuesClick={onDeleteAllIssuesClick}
          deleteAllIssuesDisabled={deleteAllIssuesDisabled}
          reorderSectionOpen={reorderSectionOpen}
          setReorderSectionOpen={setReorderSectionOpen}
          showTabsSectionOpen={showTabsSectionOpen}
          setShowTabsSectionOpen={setShowTabsSectionOpen}
          addSectionOpen={addSectionOpen}
          setAddSectionOpen={setAddSectionOpen}
          deleteProjectSectionOpen={deleteProjectSectionOpen}
          setDeleteProjectSectionOpen={setDeleteProjectSectionOpen}
          tabOrder={tabOrder}
          hiddenSet={hiddenSet}
          hiddenTabIds={hiddenTabIds}
          setHiddenTabIds={setHiddenTabIds}
          deletedTabIds={deletedTabIds}
          restoreDeletedTabs={restoreDeletedTabs}
          deleteTab={deleteTab}
          moveTabVisible={moveTabVisible}
          isMobile={isMobile}
          customLists={customLists}
          onAddClick={onAddClick}
          onOpenCreateListModal={() => {
            setCreateListName("");
            setCreateListError(null);
            setCreateListModalOpen(true);
          }}
          onOpenAppearanceSettings={onOpenAppearanceSettings}
          onOpenSettingsRoute={() => {
            void router.push("/settings");
          }}
          onDeleteProjectClick={onDeleteProjectClick}
          selectedProjectId={selectedProjectId}
          projectsLength={projects?.length}
        />
      </nav>

      <AccessibleModal
        open={createListModalOpen}
        onClose={() => setCreateListModalOpen(false)}
        title="New list page"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCreateListError(null);
            const name = createListName.trim();
            if (!name) {
              setCreateListError("Enter a name for the list.");
              return;
            }
            const list = addCustomList(name);
            setCustomLists((prev) => [
              ...prev.filter((entry) => entry.slug !== list.slug),
              list,
            ]);
            const newTabId = getCustomListTabId(list.slug);
            setTabOrder([...tabOrder, newTabId]);
            setCreateListModalOpen(false);
            setCreateListName("");
            router.push(`/list/${list.slug}`);
          }}
        >
          {createListError && (
            <ErrorBanner
              message={createListError}
              style={{ marginBottom: 16 }}
            />
          )}
          <div className="form-group">
            <label htmlFor="create-list-name">Page name</label>
            <input
              id="create-list-name"
              type="text"
              value={createListName}
              onChange={(e) => setCreateListName(e.target.value)}
              placeholder="e.g. Reading list"
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreateListModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </AccessibleModal>
      <ProjectSettingsModal
        open={projectSettingsOpen}
        onClose={() => setProjectSettingsOpen(false)}
        projectId={selectedProjectId}
        projectName={projectName}
        onRenameProject={onRenameProject}
        onDeleteProject={
          onDeleteProjectClick
            ? () => {
                onDeleteProjectClick();
              }
            : undefined
        }
      />
    </header>
  );
}
