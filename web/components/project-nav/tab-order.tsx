import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { AUTH_CHANGE_EVENT } from "../../lib/api/auth";
import {
  safeLocalStorageGet,
  safeLocalStorageGetJson,
  safeLocalStorageRemove,
  safeLocalStorageSet,
  safeLocalStorageSetJson,
} from "../../lib/storage";
import { getCustomListTabId, getCustomLists } from "../../lib/customLists";
import {
  IconBeaker,
  IconBoard,
  IconBug,
  IconCalendar,
  IconCode,
  IconEnhancements,
  IconExpenses,
  IconFeatures,
  IconGlobe,
  IconGoals,
  IconHomeBulby,
  IconIdeas,
  IconPages,
  IconSettings,
  IconTimeline,
  IconTodo,
} from "../icons";
import {
  getDeletedTabsStorageKey,
  getHiddenTabsStorageKey,
  LEGACY_TAB_ORDER_STORAGE_KEY,
  getTabOrderStorageKey,
  getTabPrefsMigrationStorageKey,
  TAB_PREFS_MIGRATION_VERSION,
} from "./utils";

/** Set when user explicitly clicks Board tab; tells _app to skip redirect away from /. */
export const EXPLICIT_BOARD_SESSION_KEY = "ideahome-explicit-board";
export const OPEN_SETTINGS_MENU_EVENT = "ideahome-open-settings-menu";

export type ProjectNavTabId =
  | "todo"
  | "ideas"
  | "enhancements"
  | "summary"
  | "timeline"
  | "board"
  | "tests"
  | "calendar"
  | "list"
  | "forms"
  | "goals"
  | "expenses"
  | "code"
  | "pages"
  | "settings"
  | `custom-${string}`;

/** Breakpoint below which the Code tab is hidden (mobile). */
const MOBILE_MAX_WIDTH = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    const handler = () => setIsMobile(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export const TABS: {
  id: ProjectNavTabId;
  label: string;
  icon: React.ReactNode;
  hasDropdown?: boolean;
  href?: string;
  /** When true, tab is hidden on mobile viewport. */
  desktopOnly?: boolean;
}[] = [
  { id: "todo", label: "To-Do", icon: <IconTodo />, href: "/todo" },
  { id: "ideas", label: "Ideas", icon: <IconIdeas />, href: "/ideas" },
  {
    id: "enhancements",
    label: "Enhancements",
    icon: <IconEnhancements />,
    href: "/enhancements",
  },
  { id: "summary", label: "Summary", icon: <IconGlobe />, href: "/summary" },
  { id: "timeline", label: "Timeline", icon: <IconTimeline /> },
  { id: "board", label: "Board", icon: <IconBoard />, href: "/" },
  { id: "tests", label: "Tests", icon: <IconBeaker />, href: "/tests" },
  {
    id: "calendar",
    label: "Calendar",
    icon: <IconCalendar />,
    href: "/calendar",
  },
  { id: "list", label: "Features", icon: <IconFeatures />, href: "/features" },
  { id: "forms", label: "Bugs", icon: <IconBug />, href: "/bugs" },
  { id: "goals", label: "Goals", icon: <IconGoals /> },
  {
    id: "expenses",
    label: "Finances",
    icon: <IconExpenses />,
    href: "/finances",
  },
  {
    id: "code",
    label: "Code",
    icon: <IconCode />,
    href: "/code",
    desktopOnly: true,
  },
  { id: "pages", label: "Pages", icon: <IconPages />, href: "/pages" },
  {
    id: "settings",
    label: "Settings",
    icon: <IconSettings />,
    href: "/settings",
  },
];

function loadHiddenTabIds(): ProjectNavTabId[] {
  if (typeof window === "undefined") return [];
  const parsed = safeLocalStorageGetJson<string[]>(
    getHiddenTabsStorageKey(),
    (value): value is string[] =>
      Array.isArray(value) && value.every((id) => typeof id === "string")
  );
  if (!parsed) return [];
  return parsed.filter(
    (id): id is ProjectNavTabId =>
      typeof id === "string" &&
      (TABS.some((t) => t.id === id) || id.startsWith("custom-"))
  );
}

function saveHiddenTabIds(ids: ProjectNavTabId[]) {
  safeLocalStorageSetJson(getHiddenTabsStorageKey(), ids);
}

function loadDeletedTabIds(): ProjectNavTabId[] {
  if (typeof window === "undefined") return [];
  const parsed = safeLocalStorageGetJson<string[]>(
    getDeletedTabsStorageKey(),
    (value): value is string[] =>
      Array.isArray(value) && value.every((id) => typeof id === "string")
  );
  if (!parsed) return [];
  return parsed.filter(
    (id): id is ProjectNavTabId =>
      typeof id === "string" &&
      (TABS.some((t) => t.id === id) || id.startsWith("custom-"))
  );
}

function saveDeletedTabIds(ids: ProjectNavTabId[]) {
  safeLocalStorageSetJson(getDeletedTabsStorageKey(), ids);
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

function getDefaultVisibleTabOrderForUser(): ProjectNavTabId[] {
  return [
    "ideas",
    "todo",
    "enhancements",
    "list",
    "forms",
    "board",
    "expenses",
  ];
}

function migrateStoredTabPreferencesToNewDefaults() {
  if (typeof window === "undefined") return;
  try {
    const migrationKey = getTabPrefsMigrationStorageKey();
    const currentVersion = safeLocalStorageGet(migrationKey);
    if (currentVersion === TAB_PREFS_MIGRATION_VERSION) return;

    const preferredOrder = getDefaultVisibleTabOrderForUser();
    const mustShow = new Set<ProjectNavTabId>(preferredOrder);

    const nextDeleted = loadDeletedTabIds().filter((id) => !mustShow.has(id));
    const loadedOrder = loadTabOrder(nextDeleted);
    const preferredPresent = preferredOrder.filter((id) =>
      loadedOrder.includes(id)
    );
    const remaining = loadedOrder.filter(
      (id) => !preferredPresent.includes(id)
    );
    const nextOrder = [...preferredPresent, ...remaining];

    const nextHidden = loadHiddenTabIds().filter(
      (id) => nextOrder.includes(id) && !mustShow.has(id)
    );

    saveDeletedTabIds(nextDeleted);
    saveTabOrder(nextOrder);
    saveHiddenTabIds(nextHidden);
    safeLocalStorageSet(migrationKey, TAB_PREFS_MIGRATION_VERSION);
  } catch {
    // ignore migration failures
  }
}

function loadFilterState() {
  migrateStoredTabPreferencesToNewDefaults();
  const deletedTabIds = loadDeletedTabIds();
  const tabOrder = loadTabOrder(deletedTabIds);
  const hiddenTabIds = loadHiddenTabIds().filter((id) => tabOrder.includes(id));
  return { tabOrder, hiddenTabIds, deletedTabIds };
}

export function TabOrderProvider({ children }: { children: React.ReactNode }) {
  const [tabOrder, setTabOrderState] =
    useState<ProjectNavTabId[]>(DEFAULT_TAB_ORDER);
  const [hiddenTabIds, setHiddenTabIdsState] = useState<ProjectNavTabId[]>([]);
  const [deletedTabIds, setDeletedTabIdsState] = useState<ProjectNavTabId[]>(
    []
  );

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
  const router = useRouter();
  const { tabOrder, hiddenTabIds } = useTabOrder();
  const isMobile = useIsMobile();
  const hiddenSet = new Set(hiddenTabIds);
  const drawerTabs = tabOrder
    .filter((id) => !hiddenSet.has(id))
    .map((id) => TABS.find((t) => t.id === id))
    .filter((t): t is (typeof TABS)[number] => Boolean(t && t.href))
    .filter((t) => !(isMobile && t.desktopOnly));
  return (
    <div className="drawer-collapsed-inner">
      <button
        type="button"
        className="drawer-toggle drawer-logo project-nav-drawer-toggle"
        onClick={onExpand}
        aria-label="Expand sidebar"
        title="Expand sidebar"
      >
        <span className="drawer-logo-mark" role="img" aria-hidden="true">
          <IconHomeBulby />
        </span>
      </button>
      <nav className="drawer-collapsed-nav" aria-label="App navigation">
        {drawerTabs.map((tab) =>
          tab.href === "/" ? (
            <button
              key={tab.id}
              type="button"
              className={`drawer-collapsed-item ${activeTab === tab.id ? "is-selected" : ""}`}
              title={tab.label}
              aria-label={tab.label}
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => {
                try {
                  sessionStorage.setItem(EXPLICIT_BOARD_SESSION_KEY, "1");
                } catch {
                  /* ignore */
                }
                void router.push("/");
              }}
            >
              {tab.icon}
            </button>
          ) : (
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
          )
        )}
      </nav>
    </div>
  );
}

const DEFAULT_TAB_ORDER: ProjectNavTabId[] = TABS.map((t) => t.id);

export function loadTabOrder(
  deletedTabIds: ProjectNavTabId[] = loadDeletedTabIds()
): ProjectNavTabId[] {
  if (typeof window === "undefined") return DEFAULT_TAB_ORDER;
  try {
    const deletedSet = new Set<ProjectNavTabId>(deletedTabIds);
    const key = getTabOrderStorageKey();
    let raw = safeLocalStorageGet(key);
    if (!raw && key !== LEGACY_TAB_ORDER_STORAGE_KEY) {
      raw = safeLocalStorageGet(LEGACY_TAB_ORDER_STORAGE_KEY);
      if (raw) {
        safeLocalStorageSet(key, raw);
        safeLocalStorageRemove(LEGACY_TAB_ORDER_STORAGE_KEY);
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
  safeLocalStorageSetJson(getTabOrderStorageKey(), order);
}

/** Returns the href of the first visible tab (user's tab order, excluding hidden). */
export function getFirstVisibleTabHref(
  excludeTabIds?: ProjectNavTabId[]
): string {
  if (typeof window === "undefined") return "/";
  const deletedTabIds = loadDeletedTabIds();
  const tabOrder = loadTabOrder(deletedTabIds);
  const hiddenSet = new Set(loadHiddenTabIds());
  const excludeSet = new Set(excludeTabIds ?? []);
  const customLists = getCustomLists();
  for (const id of tabOrder) {
    if (hiddenSet.has(id) || excludeSet.has(id)) continue;
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
