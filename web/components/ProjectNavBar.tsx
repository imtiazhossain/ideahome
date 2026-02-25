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
import type { Bug, Feature, Idea, Issue, Todo } from "../lib/api";
import {
  addCustomList,
  getCustomListTabId,
  getCustomLists,
} from "../lib/customLists";
import { IconFromName } from "./IconFromName";

const TAB_GAP = 2;

const IconGrip = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </svg>
);

const TAB_ORDER_STORAGE_PREFIX = "ideahome-project-nav-tab-order";
const LEGACY_TAB_ORDER_STORAGE_KEY = "ideahome-project-nav-tab-order";
const HIDDEN_TABS_STORAGE_PREFIX = "ideahome-project-nav-tabs-hidden";
const HIDDEN_TABS_LEGACY_KEY = "ideahome-project-nav-tabs-hidden";

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

const IconGlobe = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const IconTimeline = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconBoard = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);
const IconCalendar = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconFeatures = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconBug = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="m8 2 1.88 1.88" />
    <path d="M14.12 3.88 16 2" />
    <path d="M9 7.13v-1a3.003 3.003 0 0 1 6 0v1" />
    <path d="M12 8c-3.866 0-7 2.239-7 5v6c0 2.761 3.134 5 7 5s7-2.239 7-5v-6c0-2.761-3.134-5-7-5Z" />
    <path d="M12 18v4" />
    <path d="m6 22-2-4" />
    <path d="m18 22 2-4" />
  </svg>
);
const IconGoals = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);
const IconCode = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);
const IconHealth = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const IconPages = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconPeople = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconMore = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <circle cx="12" cy="6" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="18" r="1.5" />
  </svg>
);
const IconSearch = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);
const IconChevronDown = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const IconPlus = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconHome = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IconBeaker = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4.5 3h15v5a6 6 0 0 1-6 6v0a6 6 0 0 1-6-6V3" />
    <path d="M9 3v2" />
    <path d="M15 3v2" />
    <path d="M4.5 8h15" />
    <path d="M6 21v-5" />
    <path d="M18 21v-5" />
    <path d="M10 21h4" />
  </svg>
);
const IconExpenses = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const IconFilter = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const IconTodo = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const IconIdeas = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
);
const IconProfile = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

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
    const valid = parsed.filter((id): id is ProjectNavTabId =>
      typeof id === "string" && (TABS.some((t) => t.id === id) || id.startsWith("custom-"))
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

const TabOrderContext = React.createContext<{
  tabOrder: ProjectNavTabId[];
  setTabOrder: (order: ProjectNavTabId[]) => void;
  hiddenTabIds: ProjectNavTabId[];
  setHiddenTabIds: (ids: ProjectNavTabId[]) => void;
} | null>(null);

export function useTabOrder() {
  const ctx = React.useContext(TabOrderContext);
  if (!ctx) throw new Error("useTabOrder must be used within TabOrderProvider");
  return ctx;
}

function loadFilterState() {
  return { tabOrder: loadTabOrder(), hiddenTabIds: loadHiddenTabIds() };
}

export function TabOrderProvider({ children }: { children: React.ReactNode }) {
  const [tabOrder, setTabOrderState] =
    useState<ProjectNavTabId[]>(DEFAULT_TAB_ORDER);
  const [hiddenTabIds, setHiddenTabIdsState] = useState<ProjectNavTabId[]>([]);

  useEffect(() => {
    const apply = () => {
      const { tabOrder: order, hiddenTabIds: hidden } = loadFilterState();
      setTabOrderState(order);
      setHiddenTabIdsState(hidden);
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
  return (
    <TabOrderContext.Provider
      value={{ tabOrder, setTabOrder, hiddenTabIds, setHiddenTabIds }}
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

function loadTabOrder(): ProjectNavTabId[] {
  if (typeof window === "undefined") return DEFAULT_TAB_ORDER;
  try {
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
    const valid = parsed.filter(isValidId);
    const missingBuiltIn = TABS.filter(
      (t) => !valid.includes(t.id)
    ).map((t) => t.id);
    const missingCustom = customLists
      .map((l) => getCustomListTabId(l.slug))
      .filter((id) => !valid.includes(id));
    return valid.length
      ? [...valid, ...missingBuiltIn, ...missingCustom]
      : DEFAULT_TAB_ORDER;
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
}: ProjectNavBarProps) {
  const router = useRouter();
  const { tabOrder, setTabOrder, hiddenTabIds, setHiddenTabIds } = useTabOrder();
  const [isDraggingTabId, setIsDraggingTabId] =
    useState<ProjectNavTabId | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [createListModalOpen, setCreateListModalOpen] = useState(false);
  const [createListName, setCreateListName] = useState("");
  const [createListError, setCreateListError] = useState<string | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [projectSearchResults, setProjectSearchResults] = useState<
    ProjectSearchResult[]
  >([]);
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [projectSearchLoading, setProjectSearchLoading] = useState(false);
  const projectSearchRef = useRef<HTMLDivElement>(null);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  useEffect(() => {
    setHasToken(!!getStoredToken());
  }, []);
  const handleLogout = useCallback(() => {
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
      Promise.all([
        fetchIssueSearch(projectId, q),
        fetchTodoSearch(projectId, q),
        fetchIdeaSearch(projectId, q),
        fetchBugSearch(projectId, q),
        fetchFeatureSearch(projectId, q),
      ])
        .then(([issues, todos, ideas, bugs, features]) => {
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
          features.slice(0, PROJECT_SEARCH_MAX_PER_LIST).forEach((item: Feature) => {
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        projectSearchRef.current &&
        !projectSearchRef.current.contains(e.target as Node)
      ) {
        setProjectSearchOpen(false);
      }
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(e.target as Node)
      ) {
        setAddMenuOpen(false);
      }
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(e.target as Node)
      ) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dragJustEndedRef = useRef(false);
  const draggingTabIdRef = useRef<ProjectNavTabId | null>(null);
  const dragStartXRef = useRef(0);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const scrollDirectionRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);
  const dragRef = useRef<{
    sourceIndex: number;
    targetIndex: number;
    startX: number;
    scrollStart: number;
    slotWidth: number;
    tabIds: ProjectNavTabId[];
  } | null>(null);

  useEffect(() => {
    setTabOrder(loadTabOrder());
  }, []);

  const applyReorder = useCallback(
    (dragTabId: ProjectNavTabId, dropTabId: ProjectNavTabId) => {
      if (!dragTabId || dragTabId === dropTabId) return;
      const fromIdx = tabOrder.indexOf(dragTabId);
      const toIdx = tabOrder.indexOf(dropTabId);
      if (fromIdx === -1 || toIdx === -1) return;
      const next = tabOrder.filter((id) => id !== dragTabId);
      next.splice(toIdx, 0, dragTabId);
      setTabOrder(next);
    },
    [tabOrder, setTabOrder]
  );

  const clearAllTransforms = useCallback(() => {
    const container = tabsContainerRef.current;
    if (!container) return;
    const tabEls = Array.from(container.children) as HTMLElement[];
    tabEls.forEach((el) => {
      el.style.transform = "";
      el.style.transition = "";
      el.style.zIndex = "";
      el.style.position = "";
      el.style.boxShadow = "";
    });
  }, []);

  useEffect(() => {
    if (!isDraggingTabId) return;
    draggingTabIdRef.current = isDraggingTabId;

    const container = tabsContainerRef.current;
    if (!container) {
      setIsDraggingTabId(null);
      return;
    }
    const tabEls = Array.from(container.children) as HTMLElement[];
    const sourceIndex = tabOrder.indexOf(isDraggingTabId);
    if (sourceIndex < 0 || sourceIndex >= tabEls.length) {
      setIsDraggingTabId(null);
      return;
    }
    const draggedRect = tabEls[sourceIndex].getBoundingClientRect();
    const slotWidth = Math.max(draggedRect.width + TAB_GAP, 40);
    const startX = dragStartXRef.current;
    const scrollStart = tabsScrollRef.current?.scrollLeft ?? 0;

    dragRef.current = {
      sourceIndex,
      targetIndex: sourceIndex,
      startX,
      scrollStart,
      slotWidth,
      tabIds: [...tabOrder],
    };

    const applyTransforms = (
      sourceIdx: number,
      targetIdx: number,
      deltaX: number,
      scrollDelta: number
    ) => {
      if (!container) return;
      const tabs = Array.from(container.children) as HTMLElement[];
      const lo = Math.min(sourceIdx, targetIdx);
      const hi = Math.max(sourceIdx, targetIdx);
      const direction = targetIdx > sourceIdx ? -1 : 1;
      const dragTranslateX = deltaX + scrollDelta;

      tabs.forEach((el, i) => {
        if (i === sourceIdx) {
          el.style.transform = `translateX(${dragTranslateX}px)`;
          el.style.transition = "none";
          el.style.zIndex = "10";
          el.style.position = "relative";
          el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        } else if (i >= lo && i <= hi) {
          el.style.transform = `translateX(${direction * slotWidth}px)`;
          el.style.transition = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
          el.style.zIndex = "";
          el.style.position = "";
          el.style.boxShadow = "";
        } else {
          el.style.transform = "";
          el.style.transition = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
          el.style.zIndex = "";
          el.style.position = "";
          el.style.boxShadow = "";
        }
      });
    };

    applyTransforms(sourceIndex, sourceIndex, 0, 0);

    const SCROLL_EDGE_PX = 48;
    const SCROLL_SPEED_PX = 10;

    const scrollLoop = () => {
      const dir = scrollDirectionRef.current;
      const scrollEl = tabsScrollRef.current;
      if (dir !== 0 && scrollEl) {
        scrollEl.scrollLeft += SCROLL_SPEED_PX * dir;
      }
      scrollRafRef.current = requestAnimationFrame(scrollLoop);
    };

    scrollRafRef.current = requestAnimationFrame(scrollLoop);

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaX = e.clientX - drag.startX;
      const scrollDelta = (tabsScrollRef.current?.scrollLeft ?? 0) - drag.scrollStart;
      const { sourceIndex: srcIdx, slotWidth: sw, tabIds } = drag;
      let targetIdx = srcIdx + Math.round((deltaX + scrollDelta) / sw);
      targetIdx = Math.max(0, Math.min(targetIdx, tabIds.length - 1));
      drag.targetIndex = targetIdx;
      applyTransforms(srcIdx, targetIdx, deltaX, scrollDelta);

      const scrollEl = tabsScrollRef.current;
      if (scrollEl) {
        const r = scrollEl.getBoundingClientRect();
        if (e.clientX <= r.left + SCROLL_EDGE_PX) {
          scrollDirectionRef.current = -1;
        } else if (e.clientX >= r.right - SCROLL_EDGE_PX) {
          scrollDirectionRef.current = 1;
        } else {
          scrollDirectionRef.current = 0;
        }
      }
    };

    const onPointerUp = () => {
      const drag = dragRef.current;
      const dragId = draggingTabIdRef.current;
      let didReorder = false;
      if (drag && dragId) {
        clearAllTransforms();
        const dropId = drag.tabIds[drag.targetIndex];
        if (dropId && drag.sourceIndex !== drag.targetIndex) {
          applyReorder(dragId, dropId);
          didReorder = true;
        }
      }
      // Only suppress the next click when we actually reordered; otherwise
      // a press-and-release on the grip would eat the next tab click.
      dragJustEndedRef.current = didReorder;
      draggingTabIdRef.current = null;
      dragRef.current = null;
      setIsDraggingTabId(null);
    };

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    const capture = true;
    document.addEventListener("pointermove", onPointerMove, capture);
    document.addEventListener("pointerup", onPointerUp, capture);
    document.addEventListener("pointercancel", onPointerUp, capture);

    return () => {
      scrollDirectionRef.current = 0;
      if (scrollRafRef.current != null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("pointermove", onPointerMove, capture);
      document.removeEventListener("pointerup", onPointerUp, capture);
      document.removeEventListener("pointercancel", onPointerUp, capture);
      clearAllTransforms();
    };
  }, [isDraggingTabId, tabOrder, applyReorder, clearAllTransforms]);

  const onGripPointerDown = useCallback(
    (e: React.PointerEvent, tabId: ProjectNavTabId) => {
      // Don't preventDefault on pointerdown - allow simple taps to navigate.
      // Only start drag when the user actually moves past a threshold.
      const startX = e.clientX;
      const startY = e.clientY;
      const threshold = 5;

      const onMove = (e2: PointerEvent) => {
        const dx = Math.abs(e2.clientX - startX);
        const dy = Math.abs(e2.clientY - startY);
        if (dx > threshold || dy > threshold) {
          e2.preventDefault();
          dragStartXRef.current = e2.clientX;
          setIsDraggingTabId(tabId);
          document.removeEventListener("pointermove", onMove, true);
          document.removeEventListener("pointerup", onUp, true);
        }
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove, true);
        document.removeEventListener("pointerup", onUp, true);
      };

      document.addEventListener("pointermove", onMove, true);
      document.addEventListener("pointerup", onUp, true);
    },
    []
  );

  const suppressClickIfDragEnded = useCallback((e: React.MouseEvent) => {
    if (dragJustEndedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      dragJustEndedRef.current = false;
    }
  }, []);

  const customLists = getCustomLists();
  const hiddenSet = new Set(hiddenTabIds);
  const orderedTabs = tabOrder
    .filter((id) => !hiddenSet.has(id))
    .map((id): { id: ProjectNavTabId; label: string; icon: React.ReactNode; href?: string; hasDropdown?: boolean } | null => {
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
    })
    .filter(Boolean) as { id: ProjectNavTabId; label: string; icon: React.ReactNode; href?: string; hasDropdown?: boolean }[];

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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              </button>
            )}
            <span className="project-nav-project-icon" aria-hidden>
              <IconHome />
            </span>
            <h1 className="project-nav-project-name">
              {projectName || "Project"}
            </h1>
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
                          item.type === "issue"
                            ? item.status
                            : item.pageLabel;
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
              <span className="project-nav-auth">
                {hasToken ? (
                  <button
                    type="button"
                    className="project-nav-auth-btn"
                    onClick={handleLogout}
                    aria-label="Log out"
                    title="Log out"
                  >
                    <IconProfile />
                  </button>
                ) : (
                  <Link
                    href="/login"
                    prefetch={false}
                    className="project-nav-auth-link"
                    aria-label="Sign in"
                    title="Sign in"
                  >
                    <IconProfile />
                  </Link>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
      <nav
        className={`project-nav-tabs-wrap${isDraggingTabId ? " is-dragging" : ""}`}
        aria-label="Project views"
      >
        <div ref={tabsScrollRef} className="project-nav-tabs-scroll">
          <div
            className="project-nav-tabs"
            onClickCapture={suppressClickIfDragEnded}
          >
            <div ref={tabsContainerRef} className="project-nav-tabs-inner">
              {orderedTabs.map((tab) =>
                tab.href ? (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    prefetch={false}
                    className={`project-nav-tab ${activeTab === tab.id ? "is-active" : ""} ${isDraggingTabId === tab.id ? "is-dragging" : ""}`}
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    data-tab-id={tab.id}
                    title="Click to open; drag grip to reorder"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                  >
                    <span
                      className="project-nav-tab-grip"
                      onPointerDown={(e) => onGripPointerDown(e, tab.id)}
                      aria-label={`Drag to reorder: ${tab.label}`}
                      title="Drag to reorder"
                    >
                      <IconGrip />
                    </span>
                    <span className="project-nav-tab-icon">{tab.icon}</span>
                    <span className="project-nav-tab-label">{tab.label}</span>
                  </Link>
                ) : (
                  <button
                    key={tab.id}
                    type="button"
                    className={`project-nav-tab ${activeTab === tab.id ? "is-active" : ""} ${isDraggingTabId === tab.id ? "is-dragging" : ""}`}
                    onClick={() => onTabChange?.(tab.id)}
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    data-tab-id={tab.id}
                    title="Click to open; drag grip to reorder"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                  >
                    <span
                      className="project-nav-tab-grip"
                      onPointerDown={(e) => onGripPointerDown(e, tab.id)}
                      aria-label={`Drag to reorder: ${tab.label}`}
                      title="Drag to reorder"
                    >
                      <IconGrip />
                    </span>
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
        <div
          ref={filterMenuRef}
          className="project-nav-filter-wrap"
          style={{ position: "relative" }}
        >
          <button
            type="button"
            className={`project-nav-add project-nav-filter-btn${filterMenuOpen ? " is-open" : ""}`}
            onClick={() => setFilterMenuOpen((open) => !open)}
            aria-label="Show or hide tabs"
            title="Show or hide tabs"
            aria-expanded={filterMenuOpen}
            aria-haspopup="true"
          >
            <IconFilter />
          </button>
          {filterMenuOpen && (
            <div
              className="project-nav-add-menu project-nav-filter-menu"
              role="dialog"
              aria-label="Tab visibility"
            >
              <div className="project-nav-filter-menu-header">Show tabs</div>
              <ul className="project-nav-filter-list" role="list">
                {[...tabOrder]
                  .map((id) => {
                    const builtIn = TABS.find((t) => t.id === id);
                    const label =
                      builtIn?.label ??
                      (typeof id === "string" && id.startsWith("custom-")
                        ? customLists.find((l) => getCustomListTabId(l.slug) === id)?.name ?? id
                        : id);
                    return { id, label };
                  })
                  .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
                  .map(({ id, label }) => {
                    const visible = !hiddenSet.has(id);
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
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </div>
        <div
          ref={addMenuRef}
          className="project-nav-add-wrap"
          style={{ position: "relative" }}
        >
          <button
            type="button"
            className="project-nav-add"
            onClick={() => setAddMenuOpen((open) => !open)}
            aria-label="Add"
            title="Add"
            aria-expanded={addMenuOpen}
            aria-haspopup="true"
          >
            <IconPlus />
          </button>
          {addMenuOpen && (
            <ul
              className="project-nav-add-menu"
              role="menu"
              aria-label="Add options"
            >
              {onAddClick && (
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="project-nav-add-menu-item"
                    onClick={() => {
                      setAddMenuOpen(false);
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
                    setAddMenuOpen(false);
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
        </div>
      </nav>

      {createListModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setCreateListModalOpen(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
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
                <div
                  className="error-banner"
                  style={{ marginBottom: 16 }}
                >
                  {createListError}
                </div>
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
