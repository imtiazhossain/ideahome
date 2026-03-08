import { getUserScopedStorageKey } from "./api";

const CUSTOM_TABS_KEY_PREFIX = "ideahome-custom-tabs";
const CUSTOM_TABS_LEGACY_KEY = "ideahome-custom-tabs";
const LEGACY_LISTS_KEY_PREFIX = "ideahome-custom-lists";
const LEGACY_LISTS_KEY = "ideahome-custom-lists";
const LEGACY_LIST_ITEMS_KEY_PREFIX = "ideahome-custom-list-items";
const LIST_ITEMS_KEY_PREFIX = "ideahome-custom-tab-list-items";
const PAGE_CONTENT_KEY_PREFIX = "ideahome-custom-tab-page-content";
const BOARD_DATA_KEY_PREFIX = "ideahome-custom-tab-board-data";
const MIGRATION_KEY_PREFIX = "ideahome-custom-tabs-migration-v1";

export const CUSTOM_TABS_CHANGED_EVENT = "ideahome-custom-tabs-changed";

export type CustomTabKind = "list" | "page" | "board";

export type CustomTabIcon =
  | {
      type: "generated";
      seed: string;
      initials?: string;
      color?: string;
    }
  | {
      type: "preset";
      presetId: string;
      seed: string;
    };

export interface CustomTab {
  id: string;
  slug: string;
  name: string;
  kind: CustomTabKind;
  icon: CustomTabIcon;
  createdAt: string;
  projectId: string;
}

export interface CustomListItem {
  id: string;
  name: string;
  done: boolean;
  order: number;
}

export interface CustomPageDocument {
  content: string;
  updatedAt: string;
}

export interface CustomBoardColumn {
  id: string;
  title: string;
  order: number;
}

export interface CustomBoardCard {
  id: string;
  columnId: string;
  title: string;
  description: string;
  order: number;
}

export interface CustomBoardData {
  columns: CustomBoardColumn[];
  cards: CustomBoardCard[];
}

interface LegacyCustomList {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
}

function dispatchCustomTabsChanged(projectId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CUSTOM_TABS_CHANGED_EVENT, { detail: { projectId } })
  );
}

function slugFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "tab";
}

function uniqueSlug(base: string, existing: CustomTab[]): string {
  let slug = base;
  let n = 0;
  const used = new Set(existing.map((entry) => entry.slug));
  while (used.has(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

function getCustomTabsKey(): string {
  return getUserScopedStorageKey(CUSTOM_TABS_KEY_PREFIX, CUSTOM_TABS_LEGACY_KEY);
}

function getProjectScopedStorageKey(prefix: string, projectId: string): string {
  return getUserScopedStorageKey(
    `${prefix}-${projectId}`,
    `${prefix}-${projectId}`
  );
}

function getMigrationKey(projectId: string): string {
  return getProjectScopedStorageKey(MIGRATION_KEY_PREFIX, projectId);
}

function getListItemsKey(projectId: string, slug: string): string {
  return getProjectScopedStorageKey(LIST_ITEMS_KEY_PREFIX, `${projectId}-${slug}`);
}

function getPageContentKey(projectId: string, slug: string): string {
  return getProjectScopedStorageKey(PAGE_CONTENT_KEY_PREFIX, `${projectId}-${slug}`);
}

function getBoardDataKey(projectId: string, slug: string): string {
  return getProjectScopedStorageKey(BOARD_DATA_KEY_PREFIX, `${projectId}-${slug}`);
}

function getLegacyListsKey(): string {
  return getUserScopedStorageKey(LEGACY_LISTS_KEY_PREFIX, LEGACY_LISTS_KEY);
}

function getLegacyListItemsKey(slug: string): string {
  return getUserScopedStorageKey(
    `${LEGACY_LIST_ITEMS_KEY_PREFIX}-${slug}`,
    `${LEGACY_LIST_ITEMS_KEY_PREFIX}-${slug}`
  );
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function readAllCustomTabs(): CustomTab[] {
  const parsed = readJson<unknown[]>(getCustomTabsKey(), []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((value) => normalizeCustomTab(value))
    .filter((value): value is CustomTab => value != null);
}

function normalizeCustomTab(value: unknown): CustomTab | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<CustomTab>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.slug !== "string" ||
    typeof candidate.name !== "string" ||
    (candidate.kind !== "list" &&
      candidate.kind !== "page" &&
      candidate.kind !== "board") ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.projectId !== "string"
  ) {
    return null;
  }
  const icon = normalizeCustomTabIcon(candidate.icon, candidate.name);
  return {
    id: candidate.id,
    slug: candidate.slug,
    name: candidate.name,
    kind: candidate.kind,
    icon,
    createdAt: candidate.createdAt,
    projectId: candidate.projectId,
  };
}

function normalizeCustomTabIcon(
  value: unknown,
  fallbackSeed: string
): CustomTabIcon {
  if (value && typeof value === "object") {
    const candidate = value as Partial<CustomTabIcon>;
    if (candidate.type === "generated" && typeof candidate.seed === "string") {
      return {
        type: "generated",
        seed: candidate.seed,
        initials:
          typeof candidate.initials === "string" ? candidate.initials : undefined,
        color: typeof candidate.color === "string" ? candidate.color : undefined,
      };
    }
    if (
      candidate.type === "preset" &&
      typeof candidate.seed === "string" &&
      typeof candidate.presetId === "string"
    ) {
      return {
        type: "preset",
        presetId: candidate.presetId,
        seed: candidate.seed,
      };
    }
  }
  return { type: "generated", seed: fallbackSeed };
}

function saveAllCustomTabs(tabs: CustomTab[]): void {
  writeJson(getCustomTabsKey(), tabs);
}

function ensureLegacyListsMigrated(projectId: string): void {
  if (typeof window === "undefined" || !projectId) return;
  const migrationKey = getMigrationKey(projectId);
  if (window.localStorage.getItem(migrationKey) === "1") return;

  const legacyLists = readJson<LegacyCustomList[]>(getLegacyListsKey(), []);
  if (!Array.isArray(legacyLists) || legacyLists.length === 0) {
    window.localStorage.setItem(migrationKey, "1");
    return;
  }

  const allTabs = readAllCustomTabs();
  const existingProjectTabs = allTabs.filter((entry) => entry.projectId === projectId);
  const migratedTabs: CustomTab[] = [...allTabs];

  for (const legacy of legacyLists) {
    if (
      !legacy ||
      typeof legacy.slug !== "string" ||
      typeof legacy.name !== "string"
    ) {
      continue;
    }
    const existing = existingProjectTabs.find((entry) => entry.slug === legacy.slug);
    if (!existing) {
      migratedTabs.push({
        id: legacy.id || legacy.slug,
        slug: legacy.slug,
        name: legacy.name,
        kind: "list",
        icon: { type: "generated", seed: legacy.name },
        createdAt: legacy.createdAt || new Date().toISOString(),
        projectId,
      });
    }

    const legacyItems = readJson<CustomListItem[]>(
      getLegacyListItemsKey(legacy.slug),
      []
    );
    const nextItemsKey = getListItemsKey(projectId, legacy.slug);
    const existingItems = readJson<CustomListItem[]>(nextItemsKey, []);
    if (existingItems.length === 0 && legacyItems.length > 0) {
      writeJson(nextItemsKey, legacyItems);
    }
  }

  saveAllCustomTabs(migratedTabs);
  window.localStorage.setItem(migrationKey, "1");
}

export function getCustomTabId(slug: string): `custom-${string}` {
  return `custom-${slug}`;
}

export function getCustomTabs(projectId: string): CustomTab[] {
  if (!projectId) return [];
  ensureLegacyListsMigrated(projectId);
  return readAllCustomTabs().filter((entry) => entry.projectId === projectId);
}

export function getCustomTabBySlug(
  projectId: string,
  slug: string
): CustomTab | undefined {
  return getCustomTabs(projectId).find((entry) => entry.slug === slug);
}

export function addCustomTab(
  projectId: string,
  input: { name: string; kind: CustomTabKind; icon: CustomTabIcon }
): CustomTab {
  const trimmed = input.name.trim() || "New tab";
  const allTabs = readAllCustomTabs();
  const existing = allTabs.filter((entry) => entry.projectId === projectId);
  const slug = uniqueSlug(slugFromName(trimmed), existing);
  const created: CustomTab = {
    id: slug,
    slug,
    name: trimmed,
    kind: input.kind,
    icon: input.icon,
    createdAt: new Date().toISOString(),
    projectId,
  };
  allTabs.push(created);
  saveAllCustomTabs(allTabs);
  dispatchCustomTabsChanged(projectId);
  return created;
}

export function deleteCustomTab(projectId: string, slug: string): void {
  if (typeof window === "undefined") return;
  const nextTabs = readAllCustomTabs().filter(
    (entry) => !(entry.projectId === projectId && entry.slug === slug)
  );
  saveAllCustomTabs(nextTabs);
  window.localStorage.removeItem(getListItemsKey(projectId, slug));
  window.localStorage.removeItem(getPageContentKey(projectId, slug));
  window.localStorage.removeItem(getBoardDataKey(projectId, slug));
  dispatchCustomTabsChanged(projectId);
}

export function getCustomListItems(
  projectId: string,
  slug: string
): CustomListItem[] {
  return readJson<CustomListItem[]>(getListItemsKey(projectId, slug), []);
}

export function setCustomListItems(
  projectId: string,
  slug: string,
  items: CustomListItem[]
): void {
  writeJson(getListItemsKey(projectId, slug), items);
}

export function getCustomPageDocument(
  projectId: string,
  slug: string
): CustomPageDocument {
  return readJson<CustomPageDocument>(getPageContentKey(projectId, slug), {
    content: "# Untitled page\n\nStart writing here.",
    updatedAt: new Date(0).toISOString(),
  });
}

export function setCustomPageDocument(
  projectId: string,
  slug: string,
  document: CustomPageDocument
): void {
  writeJson(getPageContentKey(projectId, slug), document);
}

function defaultBoardData(): CustomBoardData {
  return {
    columns: [
      { id: "backlog", title: "Backlog", order: 0 },
      { id: "doing", title: "In Progress", order: 1 },
      { id: "done", title: "Done", order: 2 },
    ],
    cards: [],
  };
}

export function getCustomBoardData(
  projectId: string,
  slug: string
): CustomBoardData {
  const parsed = readJson<CustomBoardData>(getBoardDataKey(projectId, slug), defaultBoardData());
  const columns = Array.isArray(parsed.columns)
    ? parsed.columns
        .filter(
          (column): column is CustomBoardColumn =>
            Boolean(column) &&
            typeof column.id === "string" &&
            typeof column.title === "string" &&
            typeof column.order === "number"
        )
        .sort((a, b) => a.order - b.order)
    : defaultBoardData().columns;
  const cards = Array.isArray(parsed.cards)
    ? parsed.cards
        .filter(
          (card): card is CustomBoardCard =>
            Boolean(card) &&
            typeof card.id === "string" &&
            typeof card.columnId === "string" &&
            typeof card.title === "string" &&
            typeof card.description === "string" &&
            typeof card.order === "number"
        )
        .sort((a, b) => a.order - b.order)
    : [];
  return {
    columns: columns.length > 0 ? columns : defaultBoardData().columns,
    cards,
  };
}

export function setCustomBoardData(
  projectId: string,
  slug: string,
  data: CustomBoardData
): void {
  writeJson(getBoardDataKey(projectId, slug), data);
}

export function getCustomTabHref(tab: CustomTab): string {
  switch (tab.kind) {
    case "list":
      return `/list/${tab.slug}`;
    case "page":
      return `/page/${tab.slug}`;
    case "board":
      return `/board/${tab.slug}`;
    default:
      return "/";
  }
}
