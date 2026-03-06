import { getUserScopedStorageKey } from "../../lib/api/auth";

const TAB_ORDER_STORAGE_PREFIX = "ideahome-project-nav-tab-order";
export const LEGACY_TAB_ORDER_STORAGE_KEY = "ideahome-project-nav-tab-order";
const HIDDEN_TABS_STORAGE_PREFIX = "ideahome-project-nav-tabs-hidden";
const HIDDEN_TABS_LEGACY_KEY = "ideahome-project-nav-tabs-hidden";
const DELETED_TABS_STORAGE_PREFIX = "ideahome-project-nav-tabs-deleted";
const DELETED_TABS_LEGACY_KEY = "ideahome-project-nav-tabs-deleted";
const TAB_PREFS_MIGRATION_PREFIX = "ideahome-project-nav-prefs-migration";
const TAB_PREFS_MIGRATION_LEGACY_KEY = "ideahome-project-nav-prefs-migration";
const SETTINGS_BUTTON_VISIBLE_PREFIX = "ideahome-project-nav-settings-visible";
const SETTINGS_BUTTON_VISIBLE_LEGACY_KEY =
  "ideahome-project-nav-settings-visible";

export const TAB_PREFS_MIGRATION_VERSION = "default-tabs-v2";

const COMPACT_TAB_LABELS: Record<string, string> = {
  todo: "To-Do",
  ideas: "Ideas",
  enhancements: "Enh",
  summary: "Sum",
  timeline: "Time",
  board: "Board",
  tests: "Tests",
  calendar: "Cal",
  list: "Feat",
  forms: "Bugs",
  goals: "Goals",
  development: "Health",
  expenses: "Exp",
  code: "Code",
  pages: "Pages",
  settings: "Prefs",
};

export function getCompactTabLabel(tabId: string, label: string): string {
  const mapped = COMPACT_TAB_LABELS[tabId];
  if (mapped) return mapped;
  if (label.length <= 8) return label;
  const firstWord = label.split(/\s+/)[0] ?? label;
  return firstWord.slice(0, 8);
}

export function getTabOrderStorageKey(): string {
  return getUserScopedStorageKey(
    TAB_ORDER_STORAGE_PREFIX,
    LEGACY_TAB_ORDER_STORAGE_KEY
  );
}

export function getHiddenTabsStorageKey(): string {
  return getUserScopedStorageKey(
    HIDDEN_TABS_STORAGE_PREFIX,
    HIDDEN_TABS_LEGACY_KEY
  );
}

export function getSettingsButtonVisibleStorageKey(): string {
  return getUserScopedStorageKey(
    SETTINGS_BUTTON_VISIBLE_PREFIX,
    SETTINGS_BUTTON_VISIBLE_LEGACY_KEY
  );
}

export function getDeletedTabsStorageKey(): string {
  return getUserScopedStorageKey(
    DELETED_TABS_STORAGE_PREFIX,
    DELETED_TABS_LEGACY_KEY
  );
}

export function getTabPrefsMigrationStorageKey(): string {
  return getUserScopedStorageKey(
    TAB_PREFS_MIGRATION_PREFIX,
    TAB_PREFS_MIGRATION_LEGACY_KEY
  );
}
