/**
 * Shared tab definitions and helpers for app navigation.
 * Used by the native app; web can use for consistency where applicable.
 */

import type { AppTab } from "./types";
import { toUiTitleCase } from "./uiTitleCase";

export const BUILT_IN_TABS: AppTab[] = [
  "board",
  "home",
  "projects",
  "issues",
  "expenses",
  "features",
  "todos",
  "ideas",
  "bugs",
  "enhancements",
  "tests",
  "timeline",
  "calendar",
  "goals",
  "development",
  "pages",
  "settings",
];

/** Default tab order (built-in only; custom list tabs are appended when present). */
export const DEFAULT_TAB_ORDER: readonly AppTab[] = [
  "ideas",
  "todos",
  "enhancements",
  "features",
  "bugs",
  "board",
  "home",
  "projects",
  "issues",
  "expenses",
  "tests",
  "timeline",
  "calendar",
  "goals",
  "pages",
  "development",
  "settings",
] as const;

export const TAB_LABELS: Record<string, string> = {
  board: toUiTitleCase("board"),
  home: toUiTitleCase("summary"),
  projects: toUiTitleCase("projects"),
  issues: toUiTitleCase("issues"),
  expenses: toUiTitleCase("expenses"),
  features: toUiTitleCase("features"),
  todos: toUiTitleCase("to-do"),
  ideas: toUiTitleCase("ideas"),
  bugs: toUiTitleCase("bugs"),
  enhancements: toUiTitleCase("enhancements"),
  tests: toUiTitleCase("tests"),
  timeline: toUiTitleCase("timeline"),
  calendar: toUiTitleCase("calendar"),
  goals: toUiTitleCase("goals"),
  development: toUiTitleCase("code health"),
  pages: toUiTitleCase("pages"),
  settings: toUiTitleCase("settings"),
};

export function getTabLabel(tab: AppTab, customListName?: string): string {
  if (tab.startsWith("custom-") && customListName) return customListName;
  return TAB_LABELS[tab] ?? tab;
}

export function isAppTab(value: string): value is AppTab {
  if (BUILT_IN_TABS.includes(value as AppTab)) return true;
  if (typeof value === "string" && value.startsWith("custom-") && value.length > 7) return true;
  return false;
}

export function isCustomListTab(value: string): value is `custom-${string}` {
  return typeof value === "string" && value.startsWith("custom-") && value.length > 7;
}
