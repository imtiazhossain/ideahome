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
import { IconFromName } from "./IconFromName";

const IconChevronUp = () => (
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
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const IconReorder = () => (
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
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="8" y1="18" x2="16" y2="18" />
  </svg>
);

const TAB_ORDER_STORAGE_PREFIX = "ideahome-project-nav-tab-order";
const LEGACY_TAB_ORDER_STORAGE_KEY = "ideahome-project-nav-tab-order";
const HIDDEN_TABS_STORAGE_PREFIX = "ideahome-project-nav-tabs-hidden";
const HIDDEN_TABS_LEGACY_KEY = "ideahome-project-nav-tabs-hidden";
const SETTINGS_BUTTON_VISIBLE_PREFIX = "ideahome-project-nav-settings-visible";
const SETTINGS_BUTTON_VISIBLE_LEGACY_KEY = "ideahome-project-nav-settings-visible";

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
const IconChevronLeft = () => (
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
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const IconChevronRight = () => (
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
    <polyline points="9 18 15 12 9 6" />
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

const IconTrash = () => (
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
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const IconSettings = () => (
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
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

/** Returns the href of the first visible tab (user's tab order, excluding hidden). */
export function getFirstVisibleTabHref(): string {
  if (typeof window === "undefined") return "/";
  const tabOrder = loadTabOrder();
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
  const { tabOrder, setTabOrder, hiddenTabIds, setHiddenTabIds } = useTabOrder();
  const [settingsButtonVisible, setSettingsButtonVisible] = useState(true);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [reorderSectionOpen, setReorderSectionOpen] = useState(false);
  const [showTabsSectionOpen, setShowTabsSectionOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [deleteProjectSectionOpen, setDeleteProjectSectionOpen] = useState(false);
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
          const issues = (issuesRes.status === "fulfilled"
            ? issuesRes.value
            : []) as Issue[];
          const todos = (todosRes.status === "fulfilled"
            ? todosRes.value
            : []) as Todo[];
          const ideas = (ideasRes.status === "fulfilled"
            ? ideasRes.value
            : []) as Idea[];
          const bugs = (bugsRes.status === "fulfilled"
            ? bugsRes.value
            : []) as Bug[];
          const features = (featuresRes.status === "fulfilled"
            ? featuresRes.value
            : []) as Feature[];
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
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(e.target as Node)
      ) {
        setSettingsMenuOpen(false);
        setShowTabsSectionOpen(false);
        setReorderSectionOpen(false);
        setAddSectionOpen(false);
        setDeleteProjectSectionOpen(false);
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
  }, []);

  const tabsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTabOrder(loadTabOrder());
  }, []);

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
                  <span className="project-nav-project-name-chevron" aria-hidden>
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
                            void Promise.resolve(
                              onCreateProject(name)
                            ).then(() => {
                              setShowCreateProjectInput(false);
                              setNewProjectName("");
                              setProjectSwitcherOpen(false);
                            });
                          }}
                        >
                          <input
                            ref={createProjectInputRef}
                            type="text"
                            className="project-nav-project-switcher-create-input"
                            placeholder="Project name"
                            value={newProjectName}
                            onChange={(e) =>
                              setNewProjectName(e.target.value)
                            }
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
                    <button
                      type="button"
                      className="project-nav-auth-menu-item"
                      role="menuitem"
                      onClick={() => {
                        toggleTheme();
                        setAuthMenuOpen(false);
                      }}
                      aria-label={
                        theme === "light"
                          ? "Switch to dark theme"
                          : "Switch to light theme"
                      }
                    >
                      {theme === "light" ? "🌙" : "☀️"}{" "}
                      {theme === "light" ? "Dark mode" : "Light mode"}
                    </button>
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
                      setSettingsMenuOpen(false);
                      setAuthMenuOpen(false);
                      setProjectSwitcherOpen(false);
                      if (tab.href === "/") {
                        try {
                          sessionStorage.setItem(EXPLICIT_BOARD_SESSION_KEY, "1");
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
              if (!next) setSettingsMenuOpen(false);
            }}
            aria-label={settingsButtonVisible ? "Hide settings" : "Show settings"}
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
              if (!next) {
                setShowTabsSectionOpen(false);
                setReorderSectionOpen(false);
                setAddSectionOpen(false);
                setDeleteProjectSectionOpen(false);
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
                    setSettingsMenuOpen(false);
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
                          ? customLists.find((l) => getCustomListTabId(l.slug) === id)?.name ?? id
                          : id);
                      return (
                        <li key={id} className="project-nav-reorder-item">
                          <span className="project-nav-reorder-label">{label}</span>
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
                        setSettingsMenuOpen(false);
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
                      setSettingsMenuOpen(false);
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
                        setSettingsMenuOpen(false);
                        setDeleteProjectSectionOpen(false);
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
