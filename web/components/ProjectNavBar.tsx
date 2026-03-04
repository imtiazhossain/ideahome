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
import { CSS } from "@dnd-kit/utilities";
import { AUTH_CHANGE_EVENT, getStoredToken } from "../lib/api/auth";
import { logout } from "../lib/api/session";
import {
  useProjectSearch,
  type ProjectSearchResult,
} from "../lib/useProjectSearch";
import { useTheme } from "../lib/ThemeContext";
import {
  addCustomList,
  getCustomListTabId,
  getCustomLists,
} from "../lib/customLists";
import {
  IconChevronDown,
  IconChevronUp,
  IconFilter,
  IconHomeBulby,
  IconLogin,
  IconLogout,
  IconProfile,
  IconReorder,
  IconSearch,
} from "./icons";
import { AccessibleModal } from "./AccessibleModal";
import { ErrorBanner } from "./ErrorBanner";
import { IconFromName } from "./IconFromName";
import { IconPlus } from "./IconPlus";
import { IconTrash } from "./IconTrash";
import {
  getCompactTabLabel,
  getSettingsButtonVisibleStorageKey,
} from "./project-nav/utils";
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
  /** When false, hides the settings button. Default true. */
  showSettingsButton?: boolean;
}

interface ProjectNavSearchProps {
  projectId?: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange?: (value: string) => void;
  projectSearchOpen: boolean;
  setProjectSearchOpen: (open: boolean) => void;
}

function ProjectNavSearch({
  projectId,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  projectSearchOpen,
  setProjectSearchOpen,
}: ProjectNavSearchProps) {
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const {
    results: projectSearchResults,
    setResults: setProjectSearchResults,
    loading: projectSearchLoading,
  } = useProjectSearch(projectId, projectSearchQuery);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const projectSearchRef = useRef<HTMLDivElement>(null);
  const projectSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        projectSearchRef.current &&
        !projectSearchRef.current.contains(e.target as Node)
      ) {
        setProjectSearchOpen(false);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div
      className={`project-nav-search-wrap${
        mobileSearchOpen ? " is-mobile-search-open" : ""
      }`}
      ref={projectSearchRef}
      style={projectId ? { position: "relative" } : undefined}
    >
      <button
        type="button"
        className="project-nav-search-icon"
        aria-label="Open search"
        onClick={() => {
          if (
            typeof window !== "undefined" &&
            window.matchMedia("(max-width: 1024px)").matches
          ) {
            setMobileSearchOpen(true);
            requestAnimationFrame(() => projectSearchInputRef.current?.focus());
            return;
          }
          projectSearchInputRef.current?.focus();
        }}
      >
        <IconSearch />
      </button>
      <input
        ref={projectSearchInputRef}
        type="search"
        id="project-nav-search-input"
        className="project-nav-search"
        placeholder={
          projectId
            ? "A little light to find things in the dark..."
            : searchPlaceholder
        }
        value={projectId ? projectSearchQuery : searchValue}
        onChange={(e) => {
          if (projectId) {
            const v = e.target.value;
            setProjectSearchQuery(v);
            setProjectSearchOpen(!!v.trim());
          } else {
            onSearchChange?.(e.target.value);
          }
        }}
        onFocus={() => {
          setMobileSearchOpen(true);
          if (projectId && projectSearchQuery.trim()) {
            setProjectSearchOpen(true);
          }
        }}
        onBlur={() => {
          if (
            typeof window !== "undefined" &&
            window.matchMedia("(max-width: 1024px)").matches &&
            !(projectId ? projectSearchQuery.trim() : searchValue.trim())
          ) {
            setMobileSearchOpen(false);
          }
        }}
        aria-label="Search"
        aria-expanded={
          projectId
            ? projectSearchOpen && projectSearchResults.length > 0
            : undefined
        }
        aria-controls={projectId ? "project-search-results" : undefined}
        aria-autocomplete={projectId ? "list" : undefined}
      />
      {projectId &&
        projectSearchOpen &&
        (projectSearchResults.length > 0 || projectSearchLoading) && (
          <ul
            id="project-search-results"
            className="project-nav-search-results"
            role="listbox"
            aria-label="Search results"
          >
            {projectSearchLoading ? (
              <li
                className="project-nav-search-results-loading"
                role="option"
                aria-selected={false}
              >
                Searching…
              </li>
            ) : (
              projectSearchResults.map((item) => {
                const key =
                  item.type === "issue"
                    ? `issue-${item.id}`
                    : `list-${item.page}-${item.id}`;
                const href =
                  item.type === "issue"
                    ? `/?issueId=${encodeURIComponent(item.id)}`
                    : `${item.page}?projectId=${encodeURIComponent(
                        item.projectId
                      )}`;
                const title = item.type === "issue" ? item.title : item.name;
                const meta =
                  item.type === "issue" ? item.status : item.pageLabel;
                return (
                  <li key={key} role="option">
                    <Link
                      href={href}
                      prefetch={false}
                      className="project-nav-search-result-item"
                      onClick={() => {
                        setProjectSearchOpen(false);
                        setProjectSearchQuery("");
                        setProjectSearchResults([]);
                      }}
                    >
                      <span className="project-nav-search-result-title">
                        {title}
                      </span>
                      {meta && (
                        <span className="project-nav-search-result-meta">
                          {meta}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        )}
    </div>
  );
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
              className="project-nav-auth-menu-item project-nav-auth-menu-item--icon"
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
  onSelectProject,
  onCreateProject,
  onDeleteProjectClick,
  onDeleteAllIssuesClick,
  deleteAllIssuesDisabled,
  showSettingsButton = true,
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
  const [settingsButtonVisible, setSettingsButtonVisible] = useState(true);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [reorderSectionOpen, setReorderSectionOpen] = useState(false);
  const [showTabsSectionOpen, setShowTabsSectionOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [deleteProjectSectionOpen, setDeleteProjectSectionOpen] =
    useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [createListModalOpen, setCreateListModalOpen] = useState(false);
  const [createListName, setCreateListName] = useState("");
  const [createListError, setCreateListError] = useState<string | null>(null);
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const projectSwitcherRef = useRef<HTMLDivElement>(null);
  const [showCreateProjectInput, setShowCreateProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const createProjectInputRef = useRef<HTMLInputElement>(null);
  const [customLists, setCustomLists] = useState<
    ReturnType<typeof getCustomLists>
  >([]);

  useEffect(() => {
    if (showCreateProjectInput) {
      createProjectInputRef.current?.focus();
    }
  }, [showCreateProjectInput]);

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
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const { theme, toggleTheme } = useTheme();
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
    const openSettingsMenu = () => {
      setSettingsButtonVisible(true);
      setSettingsMenuOpen(true);
      setShowTabsSectionOpen(false);
      setReorderSectionOpen(false);
      setAddSectionOpen(false);
      setDeleteProjectSectionOpen(false);
    };
    window.addEventListener(OPEN_SETTINGS_MENU_EVENT, openSettingsMenu);
    return () =>
      window.removeEventListener(OPEN_SETTINGS_MENU_EVENT, openSettingsMenu);
  }, []);
  const handleLogout = useCallback(() => {
    setAuthMenuOpen(false);
    logout("/login");
  }, []);

  const closeSettingsMenu = useCallback(() => {
    setSettingsMenuOpen(false);
    setShowTabsSectionOpen(false);
    setReorderSectionOpen(false);
    setAddSectionOpen(false);
    setDeleteProjectSectionOpen(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(e.target as Node)
      ) {
        closeSettingsMenu();
      }
      if (
        projectSwitcherRef.current &&
        !projectSwitcherRef.current.contains(e.target as Node)
      ) {
        setProjectSwitcherOpen(false);
        setShowCreateProjectInput(false);
        setNewProjectName("");
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

  const moveTab = useCallback(
    (tabId: ProjectNavTabId, direction: "up" | "down") => {
      const idx = tabOrder.indexOf(tabId);
      if (idx === -1) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= tabOrder.length) return;
      const next = [...tabOrder];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      setTabOrder(next);
    },
    [tabOrder, setTabOrder]
  );

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
              {projectName || "Project"}
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
            sensors={tabsDragEnabled ? dragSensors : undefined}
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
                              setProjectSwitcherOpen(false);
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
                              setProjectSwitcherOpen(false);
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
        {showSettingsButton && (
          <div ref={settingsMenuRef} className="project-nav-settings-wrap">
            {settingsButtonVisible && settingsMenuOpen && (
              <div
                className="project-nav-settings-menu"
                role="menu"
                aria-label="Settings"
              >
                {onDeleteAllIssuesClick && (
                  <button
                    type="button"
                    role="menuitem"
                    className="project-nav-add-menu-item"
                    disabled={deleteAllIssuesDisabled}
                    onClick={() => {
                      closeSettingsMenu();
                      onDeleteAllIssuesClick();
                    }}
                    title={
                      deleteAllIssuesDisabled
                        ? "No issues to delete"
                        : "Delete all issues"
                    }
                    aria-label="Delete all issues"
                  >
                    Delete all issues
                  </button>
                )}
                <button
                  type="button"
                  className={`project-nav-settings-section-toggle${reorderSectionOpen ? " is-open" : ""}`}
                  onClick={() => setReorderSectionOpen((o) => !o)}
                  aria-expanded={reorderSectionOpen}
                  aria-label="Reorder tabs"
                  title="Reorder tabs"
                >
                  <IconReorder />
                </button>
                {reorderSectionOpen && (
                  <ul className="project-nav-reorder-list" role="list">
                    {(() => {
                      const visibleTabs = tabOrder
                        .filter((id) => !hiddenSet.has(id))
                        .filter(
                          (id) =>
                            !(
                              isMobile &&
                              TABS.find((t) => t.id === id)?.desktopOnly
                            )
                        );
                      return visibleTabs.map((id, visibleIdx) => {
                        const builtIn = TABS.find((t) => t.id === id);
                        const label =
                          builtIn?.label ??
                          (typeof id === "string" && id.startsWith("custom-")
                            ? (customLists.find(
                                (l) => getCustomListTabId(l.slug) === id
                              )?.name ?? id)
                            : id);
                        return (
                          <li key={id} className="project-nav-reorder-item">
                            <span className="project-nav-reorder-label">
                              {label}
                            </span>
                            <span className="project-nav-reorder-actions">
                              <button
                                type="button"
                                className="project-nav-reorder-btn"
                                onClick={() => moveTabVisible(id, "up")}
                                disabled={visibleIdx === 0}
                                aria-label={`Move ${label} up`}
                                title="Move up"
                              >
                                <IconChevronUp />
                              </button>
                            </span>
                          </li>
                        );
                      });
                    })()}
                  </ul>
                )}
                <button
                  type="button"
                  className={`project-nav-settings-section-toggle${showTabsSectionOpen ? " is-open" : ""}`}
                  onClick={() => setShowTabsSectionOpen((o) => !o)}
                  aria-expanded={showTabsSectionOpen}
                  aria-label="Filter tabs"
                >
                  <IconFilter />
                </button>
                {showTabsSectionOpen && (
                  <ul className="project-nav-filter-list" role="list">
                    {[...tabOrder]
                      .filter(
                        (id) =>
                          !(
                            isMobile &&
                            TABS.find((t) => t.id === id)?.desktopOnly
                          )
                      )
                      .map((id) => {
                        const builtIn = TABS.find((t) => t.id === id);
                        const label =
                          builtIn?.label ??
                          (typeof id === "string" && id.startsWith("custom-")
                            ? (customLists.find(
                                (l) => getCustomListTabId(l.slug) === id
                              )?.name ?? id)
                            : id);
                        return { id, label };
                      })
                      .sort((a, b) =>
                        a.label.localeCompare(b.label, undefined, {
                          sensitivity: "base",
                        })
                      )
                      .map(({ id, label }) => {
                        const visible = !hiddenSet.has(id);
                        const canDelete = tabOrder.length > 1;
                        return (
                          <li key={id} className="project-nav-filter-item">
                            <label className="project-nav-filter-label">
                              <input
                                type="checkbox"
                                checked={visible}
                                onChange={() => {
                                  const next = visible
                                    ? [...hiddenTabIds, id]
                                    : hiddenTabIds.filter((h) => h !== id);
                                  setHiddenTabIds(next);
                                }}
                                aria-label={`${visible ? "Hide" : "Show"} ${label}`}
                              />
                              <span>{label}</span>
                            </label>
                            <button
                              type="button"
                              className="project-nav-filter-delete"
                              onClick={() => deleteTab(id)}
                              aria-label={`Delete ${label} tab`}
                              title={
                                canDelete
                                  ? `Delete ${label} tab`
                                  : "At least one tab must remain"
                              }
                              disabled={!canDelete}
                            >
                              <IconTrash />
                            </button>
                          </li>
                        );
                      })}
                    <li className="project-nav-filter-item project-nav-filter-restore-row">
                      <button
                        type="button"
                        role="menuitem"
                        className="project-nav-add-menu-item project-nav-filter-restore-btn"
                        disabled={deletedTabIds.length === 0}
                        onClick={restoreDeletedTabs}
                        title={
                          deletedTabIds.length === 0
                            ? "No deleted tabs to restore"
                            : "Restore deleted tabs"
                        }
                        aria-label="Restore deleted tabs"
                      >
                        Restore deleted tabs
                      </button>
                    </li>
                  </ul>
                )}
                <button
                  type="button"
                  className={`project-nav-settings-section-toggle project-nav-settings-section-header${addSectionOpen ? " is-open" : ""}`}
                  onClick={() => setAddSectionOpen((o) => !o)}
                  aria-expanded={addSectionOpen}
                  aria-label="Add"
                >
                  <IconPlus />
                </button>
                {addSectionOpen && (
                  <ul className="project-nav-add-menu-list" role="list">
                    {onAddClick && (
                      <li role="none">
                        <button
                          type="button"
                          role="menuitem"
                          className="project-nav-add-menu-item"
                          onClick={() => {
                            closeSettingsMenu();
                            onAddClick();
                          }}
                        >
                          Create Deck
                        </button>
                      </li>
                    )}
                    <li role="none">
                      <button
                        type="button"
                        role="menuitem"
                        className="project-nav-add-menu-item"
                        onClick={() => {
                          closeSettingsMenu();
                          setCreateListName("");
                          setCreateListError(null);
                          setCreateListModalOpen(true);
                        }}
                      >
                        New list…
                      </button>
                    </li>
                  </ul>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="project-nav-settings-section-toggle"
                  onClick={() => {
                    toggleTheme();
                  }}
                  aria-label={
                    theme === "light"
                      ? "Switch to dark theme"
                      : "Switch to light theme"
                  }
                  title={
                    theme === "light"
                      ? "Switch to dark theme"
                      : "Switch to light theme"
                  }
                >
                  <span className="project-nav-theme-icon" aria-hidden>
                    {theme === "light" ? "🌙" : "☀️"}
                  </span>
                </button>
                {onDeleteProjectClick && (
                  <>
                    <button
                      type="button"
                      className={`project-nav-settings-section-toggle project-nav-settings-section-header${deleteProjectSectionOpen ? " is-open" : ""}`}
                      onClick={() => setDeleteProjectSectionOpen((o) => !o)}
                      aria-expanded={deleteProjectSectionOpen}
                      aria-label="Delete project"
                      title="Delete project"
                    >
                      <IconTrash />
                    </button>
                    {deleteProjectSectionOpen && (
                      <button
                        type="button"
                        role="menuitem"
                        className="project-nav-add-menu-item project-nav-settings-delete-project"
                        disabled={!selectedProjectId || !projects?.length}
                        onClick={() => {
                          closeSettingsMenu();
                          onDeleteProjectClick();
                        }}
                        title={
                          !selectedProjectId || !projects?.length
                            ? "No project to delete"
                            : "Delete the Project"
                        }
                        aria-label="Delete the Project"
                      >
                        Delete the Project
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
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
    </header>
  );
}
