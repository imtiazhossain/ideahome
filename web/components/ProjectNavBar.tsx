import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  AUTH_CHANGE_EVENT,
  fetchBugSearch,
  fetchFeatureSearch,
  fetchIdeaSearch,
  fetchIssueSearch,
  fetchTodoSearch,
  getStoredToken,
  getUserScopedStorageKey,
  logout,
} from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import type { Bug, Feature, Idea, Issue, Todo } from "../lib/api";
import {
  addCustomList,
  getCustomListTabId,
  getCustomLists,
} from "../lib/customLists";
import {
  IconBeaker,
  IconBoard,
  IconBug,
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCode,
  IconExpenses,
  IconFeatures,
  IconFilter,
  IconGlobe,
  IconGoals,
  IconHealth,
  IconHome,
  IconIdeas,
  IconMenu,
  IconPages,
  IconProfile,
  IconReorder,
  IconSearch,
  IconSettings,
  IconTimeline,
  IconTodo,
} from "./icons";
import { ErrorBanner } from "./ErrorBanner";
import { IconFromName } from "./IconFromName";
import { IconPlus } from "./IconPlus";
import { IconTrash } from "./IconTrash";

const TAB_ORDER_STORAGE_PREFIX = "ideahome-project-nav-tab-order";
const LEGACY_TAB_ORDER_STORAGE_KEY = "ideahome-project-nav-tab-order";
const HIDDEN_TABS_STORAGE_PREFIX = "ideahome-project-nav-tabs-hidden";
const HIDDEN_TABS_LEGACY_KEY = "ideahome-project-nav-tabs-hidden";
const DELETED_TABS_STORAGE_PREFIX = "ideahome-project-nav-tabs-deleted";
const DELETED_TABS_LEGACY_KEY = "ideahome-project-nav-tabs-deleted";
const SETTINGS_BUTTON_VISIBLE_PREFIX = "ideahome-project-nav-settings-visible";
const SETTINGS_BUTTON_VISIBLE_LEGACY_KEY =
  "ideahome-project-nav-settings-visible";

/** Set when user explicitly clicks Board tab; tells _app to skip redirect away from /. */
export const EXPLICIT_BOARD_SESSION_KEY = "ideahome-explicit-board";

function getTabOrderStorageKey(): string {
  return getUserScopedStorageKey(
    TAB_ORDER_STORAGE_PREFIX,
    LEGACY_TAB_ORDER_STORAGE_KEY
  );
}

function getHiddenTabsStorageKey(): string {
  return getUserScopedStorageKey(
    HIDDEN_TABS_STORAGE_PREFIX,
    HIDDEN_TABS_LEGACY_KEY
  );
}

function getSettingsButtonVisibleStorageKey(): string {
  return getUserScopedStorageKey(
    SETTINGS_BUTTON_VISIBLE_PREFIX,
    SETTINGS_BUTTON_VISIBLE_LEGACY_KEY
  );
}

function getDeletedTabsStorageKey(): string {
  return getUserScopedStorageKey(
    DELETED_TABS_STORAGE_PREFIX,
    DELETED_TABS_LEGACY_KEY
  );
}

export type ProjectNavTabId =
  | "todo"
  | "ideas"
  | "summary"
  | "timeline"
  | "board"
  | "tests"
  | "calendar"
  | "list"
  | "forms"
  | "goals"
  | "development"
  | "expenses"
  | "code"
  | "pages"
  | `custom-${string}`;

const TABS: {
  id: ProjectNavTabId;
  label: string;
  icon: React.ReactNode;
  hasDropdown?: boolean;
  href?: string;
}[] = [
  { id: "todo", label: "To-Do", icon: <IconTodo />, href: "/todo" },
  { id: "ideas", label: "Ideas", icon: <IconIdeas />, href: "/ideas" },
  { id: "summary", label: "Summary", icon: <IconGlobe /> },
  { id: "timeline", label: "Timeline", icon: <IconTimeline /> },
  { id: "board", label: "Board", icon: <IconBoard />, href: "/" },
  { id: "tests", label: "Tests", icon: <IconBeaker />, href: "/tests" },
  { id: "calendar", label: "Calendar", icon: <IconCalendar /> },
  { id: "list", label: "Features", icon: <IconFeatures />, href: "/features" },
  { id: "forms", label: "Bugs", icon: <IconBug />, href: "/bugs" },
  { id: "goals", label: "Goals", icon: <IconGoals /> },
  {
    id: "development",
    label: "Code Health",
    icon: <IconHealth />,
    href: "/coverage",
  },
  {
    id: "expenses",
    label: "Expenses",
    icon: <IconExpenses />,
    href: "/expenses",
  },
  { id: "code", label: "Code", icon: <IconCode /> },
  { id: "pages", label: "Pages", icon: <IconPages /> },
];

function loadHiddenTabIds(): ProjectNavTabId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getHiddenTabsStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter(
      (id): id is ProjectNavTabId =>
        typeof id === "string" &&
        (TABS.some((t) => t.id === id) || id.startsWith("custom-"))
    );
    return valid;
  } catch {
    return [];
  }
}

function saveHiddenTabIds(ids: ProjectNavTabId[]) {
  try {
    localStorage.setItem(getHiddenTabsStorageKey(), JSON.stringify(ids));
  } catch {
    // ignore
  }
}

function loadDeletedTabIds(): ProjectNavTabId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getDeletedTabsStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter(
      (id): id is ProjectNavTabId =>
        typeof id === "string" &&
        (TABS.some((t) => t.id === id) || id.startsWith("custom-"))
    );
  } catch {
    return [];
  }
}

function saveDeletedTabIds(ids: ProjectNavTabId[]) {
  try {
    localStorage.setItem(getDeletedTabsStorageKey(), JSON.stringify(ids));
  } catch {
    // ignore
  }
}

const TabOrderContext = React.createContext<{
  tabOrder: ProjectNavTabId[];
  setTabOrder: (order: ProjectNavTabId[]) => void;
  hiddenTabIds: ProjectNavTabId[];
  setHiddenTabIds: (ids: ProjectNavTabId[]) => void;
  deletedTabIds: ProjectNavTabId[];
  setDeletedTabIds: (ids: ProjectNavTabId[]) => void;
} | null>(null);

export function useTabOrder() {
  const ctx = React.useContext(TabOrderContext);
  if (!ctx) throw new Error("useTabOrder must be used within TabOrderProvider");
  return ctx;
}

function loadFilterState() {
  const deletedTabIds = loadDeletedTabIds();
  const tabOrder = loadTabOrder(deletedTabIds);
  const hiddenTabIds = loadHiddenTabIds().filter((id) => tabOrder.includes(id));
  return { tabOrder, hiddenTabIds, deletedTabIds };
}

export function TabOrderProvider({ children }: { children: React.ReactNode }) {
  const [tabOrder, setTabOrderState] =
    useState<ProjectNavTabId[]>(DEFAULT_TAB_ORDER);
  const [hiddenTabIds, setHiddenTabIdsState] = useState<ProjectNavTabId[]>([]);
  const [deletedTabIds, setDeletedTabIdsState] = useState<ProjectNavTabId[]>([]);

  useEffect(() => {
    const apply = () => {
      const {
        tabOrder: order,
        hiddenTabIds: hidden,
        deletedTabIds: deleted,
      } = loadFilterState();
      setTabOrderState(order);
      setHiddenTabIdsState(hidden);
      setDeletedTabIdsState(deleted);
    };
    apply();
    const onAuthChange = () => apply();
    window.addEventListener(AUTH_CHANGE_EVENT, onAuthChange);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, onAuthChange);
  }, []);
  const setTabOrder = useCallback((order: ProjectNavTabId[]) => {
    setTabOrderState(order);
    saveTabOrder(order);
  }, []);
  const setHiddenTabIds = useCallback((ids: ProjectNavTabId[]) => {
    setHiddenTabIdsState(ids);
    saveHiddenTabIds(ids);
  }, []);
  const setDeletedTabIds = useCallback((ids: ProjectNavTabId[]) => {
    setDeletedTabIdsState(ids);
    saveDeletedTabIds(ids);
  }, []);
  return (
    <TabOrderContext.Provider
      value={{
        tabOrder,
        setTabOrder,
        hiddenTabIds,
        setHiddenTabIds,
        deletedTabIds,
        setDeletedTabIds,
      }}
    >
      {children}
    </TabOrderContext.Provider>
  );
}

export interface DrawerCollapsedNavProps {
  activeTab: ProjectNavTabId;
  onExpand: () => void;
}

export function DrawerCollapsedNav({
  activeTab,
  onExpand,
}: DrawerCollapsedNavProps) {
  const { tabOrder, hiddenTabIds } = useTabOrder();
  const hiddenSet = new Set(hiddenTabIds);
  const drawerTabs = tabOrder
    .filter((id) => !hiddenSet.has(id))
    .map((id) => TABS.find((t) => t.id === id))
    .filter((t): t is (typeof TABS)[number] => Boolean(t && t.href));
  return (
    <div className="drawer-collapsed-inner">
      <button
        type="button"
        className="drawer-toggle"
        onClick={onExpand}
        aria-label="Expand sidebar"
        title="Expand sidebar"
      >
        ▶
      </button>
      <nav className="drawer-collapsed-nav" aria-label="App navigation">
        {drawerTabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href!}
            prefetch={false}
            className={`drawer-collapsed-item ${activeTab === tab.id ? "is-selected" : ""}`}
            title={tab.label}
            aria-label={tab.label}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.icon}
          </Link>
        ))}
      </nav>
    </div>
  );
}

const DEFAULT_TAB_ORDER: ProjectNavTabId[] = TABS.map((t) => t.id);

function loadTabOrder(deletedTabIds: ProjectNavTabId[] = loadDeletedTabIds()): ProjectNavTabId[] {
  if (typeof window === "undefined") return DEFAULT_TAB_ORDER;
  try {
    const deletedSet = new Set<ProjectNavTabId>(deletedTabIds);
    const key = getTabOrderStorageKey();
    let raw = localStorage.getItem(key);
    if (!raw && key !== LEGACY_TAB_ORDER_STORAGE_KEY) {
      raw = localStorage.getItem(LEGACY_TAB_ORDER_STORAGE_KEY);
      if (raw) {
        localStorage.setItem(key, raw);
        localStorage.removeItem(LEGACY_TAB_ORDER_STORAGE_KEY);
      }
    }
    if (!raw) return DEFAULT_TAB_ORDER;
    const parsed = JSON.parse(raw) as string[];
    const customLists = getCustomLists();
    const customIds = new Set<string>(
      customLists.map((l) => getCustomListTabId(l.slug))
    );
    const isValidId = (id: string): id is ProjectNavTabId =>
      TABS.some((t) => t.id === id) || customIds.has(id);
    const valid = parsed.filter(
      (id): id is ProjectNavTabId => isValidId(id) && !deletedSet.has(id)
    );
    const missingBuiltIn = TABS.filter(
      (t) => !valid.includes(t.id) && !deletedSet.has(t.id)
    ).map((t) => t.id);
    const missingCustom = customLists
      .map((l) => getCustomListTabId(l.slug))
      .filter((id) => !valid.includes(id) && !deletedSet.has(id));
    const merged = [...valid, ...missingBuiltIn, ...missingCustom];
    if (merged.length > 0) return merged;
    const fallbackBuiltIn = TABS.find((t) => !deletedSet.has(t.id))?.id;
    return fallbackBuiltIn ? [fallbackBuiltIn] : ["board"];
  } catch {
    return DEFAULT_TAB_ORDER;
  }
}

function saveTabOrder(order: ProjectNavTabId[]) {
  try {
    localStorage.setItem(getTabOrderStorageKey(), JSON.stringify(order));
  } catch {
    // ignore
  }
}

/** Returns the href of the first visible tab (user's tab order, excluding hidden). */
export function getFirstVisibleTabHref(): string {
  if (typeof window === "undefined") return "/";
  const deletedTabIds = loadDeletedTabIds();
  const tabOrder = loadTabOrder(deletedTabIds);
  const hiddenSet = new Set(loadHiddenTabIds());
  const customLists = getCustomLists();
  for (const id of tabOrder) {
    if (hiddenSet.has(id)) continue;
    const builtIn = TABS.find((t) => t.id === id);
    if (builtIn?.href) return builtIn.href;
    if (typeof id === "string" && id.startsWith("custom-")) {
      const slug = id.slice(7);
      const list = customLists.find((l) => l.slug === slug);
      if (list) return `/list/${list.slug}`;
    }
  }
  return "/";
}

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

const PROJECT_SEARCH_DEBOUNCE_MS = 250;
const PROJECT_SEARCH_MAX_ISSUES = 8;
const PROJECT_SEARCH_MAX_PER_LIST = 4;

type ProjectSearchResult =
  | { type: "issue"; id: string; title: string; status?: string }
  | {
      type: "list";
      id: string;
      name: string;
      page: string;
      pageLabel: string;
      projectId: string;
    };

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
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const authMenuRef = useRef<HTMLDivElement>(null);
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const projectSwitcherRef = useRef<HTMLDivElement>(null);
  const [showCreateProjectInput, setShowCreateProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const createProjectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCreateProjectInput) {
      createProjectInputRef.current?.focus();
    }
  }, [showCreateProjectInput]);

  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [projectSearchResults, setProjectSearchResults] = useState<
    ProjectSearchResult[]
  >([]);
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [projectSearchLoading, setProjectSearchLoading] = useState(false);
  const projectSearchRef = useRef<HTMLDivElement>(null);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const { theme, toggleTheme } = useTheme();
  useEffect(() => {
    setHasToken(!!getStoredToken());
  }, []);
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
  const handleLogout = useCallback(() => {
    setAuthMenuOpen(false);
    logout("/login");
  }, []);

  useEffect(() => {
    if (!projectId || !projectSearchQuery.trim()) {
      setProjectSearchResults([]);
      return;
    }
    setProjectSearchLoading(true);
    const q = projectSearchQuery.trim();
    const t = setTimeout(() => {
      const fetches = [
        fetchIssueSearch(projectId, q),
        fetchTodoSearch(projectId, q),
        fetchIdeaSearch(projectId, q),
        fetchBugSearch(projectId, q),
        fetchFeatureSearch(projectId, q),
      ];
      Promise.allSettled(fetches)
        .then((settled) => {
          const [issuesRes, todosRes, ideasRes, bugsRes, featuresRes] = settled;
          const issues = (
            issuesRes.status === "fulfilled" ? issuesRes.value : []
          ) as Issue[];
          const todos = (
            todosRes.status === "fulfilled" ? todosRes.value : []
          ) as Todo[];
          const ideas = (
            ideasRes.status === "fulfilled" ? ideasRes.value : []
          ) as Idea[];
          const bugs = (
            bugsRes.status === "fulfilled" ? bugsRes.value : []
          ) as Bug[];
          const features = (
            featuresRes.status === "fulfilled" ? featuresRes.value : []
          ) as Feature[];
          if (
            issuesRes.status === "rejected" ||
            todosRes.status === "rejected" ||
            ideasRes.status === "rejected" ||
            bugsRes.status === "rejected" ||
            featuresRes.status === "rejected"
          ) {
            console.warn(
              "[ProjectNavBar] Search partial failure:",
              [
                issuesRes.status === "rejected" && "issues",
                todosRes.status === "rejected" && "todos",
                ideasRes.status === "rejected" && "ideas",
                bugsRes.status === "rejected" && "bugs",
                featuresRes.status === "rejected" && "features",
              ]
                .filter(Boolean)
                .join(", ")
            );
          }
          const results: ProjectSearchResult[] = [];
          issues.slice(0, PROJECT_SEARCH_MAX_ISSUES).forEach((i: Issue) => {
            results.push({
              type: "issue",
              id: i.id,
              title: i.title,
              status: i.status ?? undefined,
            });
          });
          todos.slice(0, PROJECT_SEARCH_MAX_PER_LIST).forEach((item: Todo) => {
            results.push({
              type: "list",
              id: item.id,
              name: item.name,
              page: "/todo",
              pageLabel: "To-Do",
              projectId: item.projectId,
            });
          });
          ideas.slice(0, PROJECT_SEARCH_MAX_PER_LIST).forEach((item: Idea) => {
            results.push({
              type: "list",
              id: item.id,
              name: item.name,
              page: "/ideas",
              pageLabel: "Ideas",
              projectId: item.projectId,
            });
          });
          bugs.slice(0, PROJECT_SEARCH_MAX_PER_LIST).forEach((item: Bug) => {
            results.push({
              type: "list",
              id: item.id,
              name: item.name,
              page: "/bugs",
              pageLabel: "Bugs",
              projectId: item.projectId,
            });
          });
          features
            .slice(0, PROJECT_SEARCH_MAX_PER_LIST)
            .forEach((item: Feature) => {
              results.push({
                type: "list",
                id: item.id,
                name: item.name,
                page: "/features",
                pageLabel: "Features",
                projectId: item.projectId,
              });
            });
          setProjectSearchResults(results);
        })
        .catch(() => setProjectSearchResults([]))
        .finally(() => setProjectSearchLoading(false));
    }, PROJECT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [projectId, projectSearchQuery]);

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
        projectSearchRef.current &&
        !projectSearchRef.current.contains(e.target as Node)
      ) {
        setProjectSearchOpen(false);
      }
      if (
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(e.target as Node)
      ) {
        closeSettingsMenu();
      }
      if (
        authMenuRef.current &&
        !authMenuRef.current.contains(e.target as Node)
      ) {
        setAuthMenuOpen(false);
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
        void router.push(getFirstVisibleTabHref());
      }
    },
    [
      activeTab,
      deletedTabIds,
      hiddenTabIds,
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

  const customLists = getCustomLists();
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
    .filter(Boolean) as {
    id: ProjectNavTabId;
    label: string;
    icon: React.ReactNode;
    href?: string;
    hasDropdown?: boolean;
  }[];

  return (
    <header className="project-nav">
      <div className="project-nav-top">
        <div className="project-nav-identity">
          <span className="project-nav-spaces">Spaces</span>
          <div className="project-nav-title-row">
            {onOpenDrawer && (
              <button
                type="button"
                className="project-nav-menu-btn"
                onClick={onOpenDrawer}
                aria-label="Open menu"
                title="Open menu"
              >
                <IconMenu />
                <span className="project-nav-menu-btn-label">Menu</span>
              </button>
            )}
            <span className="project-nav-project-icon" aria-hidden>
              <IconHome />
            </span>
            {projects && onSelectProject ? (
              <div
                className="project-nav-project-switcher-wrap"
                ref={projectSwitcherRef}
              >
                <button
                  type="button"
                  className={`project-nav-project-name-btn${projectSwitcherOpen ? " is-open" : ""}`}
                  onClick={() => setProjectSwitcherOpen((o) => !o)}
                  aria-label="Switch project"
                  aria-expanded={projectSwitcherOpen}
                  aria-haspopup="true"
                >
                  <h1 className="project-nav-project-name">
                    {projectName || "Project"}
                  </h1>
                  <span
                    className="project-nav-project-name-chevron"
                    aria-hidden
                  >
                    <IconChevronDown />
                  </span>
                </button>
                {projectSwitcherOpen && (
                  <div
                    className="project-nav-project-switcher-menu"
                    role="menu"
                  >
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`project-nav-project-switcher-item${selectedProjectId === p.id ? " is-selected" : ""}`}
                        role="menuitem"
                        onClick={() => {
                          onSelectProject(p.id);
                          setProjectSwitcherOpen(false);
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                    {onCreateProject &&
                      (showCreateProjectInput ? (
                        <form
                          className="project-nav-project-switcher-create-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const name = newProjectName.trim();
                            if (!name) return;
                            void Promise.resolve(onCreateProject(name)).then(
                              () => {
                                setShowCreateProjectInput(false);
                                setNewProjectName("");
                                setProjectSwitcherOpen(false);
                              }
                            );
                          }}
                        >
                          <input
                            ref={createProjectInputRef}
                            type="text"
                            className="project-nav-project-switcher-create-input"
                            placeholder="Project name"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            onBlur={() => {
                              if (!newProjectName.trim()) {
                                setShowCreateProjectInput(false);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setShowCreateProjectInput(false);
                                setNewProjectName("");
                              }
                            }}
                            aria-label="Project name"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="project-nav-project-switcher-create-submit"
                            disabled={!newProjectName.trim()}
                          >
                            Create
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="project-nav-project-switcher-item project-nav-project-switcher-item-create"
                          role="menuitem"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowCreateProjectInput(true);
                          }}
                        >
                          <IconPlus />
                          Create new project
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <h1 className="project-nav-project-name">
                {projectName || "Project"}
              </h1>
            )}
            <div
              className="project-nav-search-wrap"
              ref={projectSearchRef}
              style={projectId ? { position: "relative" } : undefined}
            >
              <span className="project-nav-search-icon" aria-hidden>
                <IconSearch />
              </span>
              <input
                type="search"
                id="project-nav-search-input"
                className="project-nav-search"
                placeholder={projectId ? "Search project" : searchPlaceholder}
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
                onFocus={() =>
                  projectId &&
                  projectSearchQuery.trim() &&
                  setProjectSearchOpen(true)
                }
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
                            : `${item.page}?projectId=${encodeURIComponent(item.projectId)}`;
                        const title =
                          item.type === "issue" ? item.title : item.name;
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
            {hasToken !== null && (
              <span
                className="project-nav-auth project-nav-auth-wrap"
                ref={authMenuRef}
              >
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
                        className="project-nav-auth-menu-item"
                        role="menuitem"
                        onClick={handleLogout}
                      >
                        Log out
                      </button>
                    ) : (
                      <Link
                        href="/login"
                        prefetch={false}
                        className="project-nav-auth-menu-item"
                        role="menuitem"
                        onClick={() => setAuthMenuOpen(false)}
                      >
                        Log in
                      </Link>
                    )}
                  </div>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
      <nav className="project-nav-tabs-wrap" aria-label="Project views">
        <div ref={tabsScrollRef} className="project-nav-tabs-scroll">
          <div className="project-nav-tabs">
            <div className="project-nav-tabs-inner">
              {orderedTabs.map((tab) =>
                tab.href ? (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    prefetch={false}
                    className={`project-nav-tab ${activeTab === tab.id ? "is-active" : ""}`}
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    data-tab-id={tab.id}
                    title={tab.label}
                    onClick={() => {
                      setProjectSearchOpen(false);
                      closeSettingsMenu();
                      setAuthMenuOpen(false);
                      setProjectSwitcherOpen(false);
                      if (tab.href === "/") {
                        try {
                          sessionStorage.setItem(
                            EXPLICIT_BOARD_SESSION_KEY,
                            "1"
                          );
                        } catch {
                          /* ignore */
                        }
                      }
                      if (activeTab === tab.id) {
                        const main = document.querySelector(".main-content");
                        if (main) main.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                  >
                    <span className="project-nav-tab-icon">{tab.icon}</span>
                    <span className="project-nav-tab-label">{tab.label}</span>
                  </Link>
                ) : (
                  <button
                    key={tab.id}
                    type="button"
                    className={`project-nav-tab ${activeTab === tab.id ? "is-active" : ""}`}
                    onClick={() => onTabChange?.(tab.id)}
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    data-tab-id={tab.id}
                    title={tab.label}
                  >
                    <span className="project-nav-tab-icon">{tab.icon}</span>
                    <span className="project-nav-tab-label">{tab.label}</span>
                    {tab.hasDropdown && (
                      <span className="project-nav-tab-chevron" aria-hidden>
                        <IconChevronDown />
                      </span>
                    )}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
        {showSettingsButton && (
          <div ref={settingsMenuRef} className="project-nav-settings-wrap">
            <button
              type="button"
              className="project-nav-add project-nav-settings-toggle-btn"
              onClick={() => {
                const next = !settingsButtonVisible;
                setSettingsButtonVisible(next);
                try {
                  localStorage.setItem(
                    getSettingsButtonVisibleStorageKey(),
                    next ? "1" : "0"
                  );
                } catch {
                  /* ignore */
                }
                if (!next) closeSettingsMenu();
              }}
              aria-label={
                settingsButtonVisible ? "Hide settings" : "Show settings"
              }
              title={settingsButtonVisible ? "Hide settings" : "Show settings"}
              aria-expanded={settingsButtonVisible}
            >
              {settingsButtonVisible ? (
                <IconChevronRight />
              ) : (
                <IconChevronLeft />
              )}
            </button>
            {settingsButtonVisible && (
              <button
                type="button"
                className={`project-nav-add project-nav-settings-btn${settingsMenuOpen ? " is-open" : ""}`}
                onClick={() => {
                  const next = !settingsMenuOpen;
                  setSettingsMenuOpen(next);
                  if (next) {
                    setShowTabsSectionOpen(false);
                    setReorderSectionOpen(false);
                    setAddSectionOpen(false);
                    setDeleteProjectSectionOpen(false);
                  } else {
                    closeSettingsMenu();
                  }
                }}
                aria-label="Settings"
                title="Settings"
                aria-expanded={settingsMenuOpen}
                aria-haspopup="true"
              >
                <IconSettings />
              </button>
            )}
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
                      const visibleTabs = tabOrder.filter(
                        (id) => !hiddenSet.has(id)
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

      {createListModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setCreateListModalOpen(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New list page</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setCreateListModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
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
          </div>
        </div>
      )}
    </header>
  );
}
