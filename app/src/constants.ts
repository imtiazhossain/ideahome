import {
  DEFAULT_TAB_ORDER as SHARED_DEFAULT_TAB_ORDER,
  EXPENSE_CATEGORIES as SHARED_EXPENSE_CATEGORIES,
  IDEAHOME_API_ORIGIN,
  IDEAHOME_WEB_ORIGIN,
  MOBILE_ACTIVE_TAB_STORAGE_KEY,
  MOBILE_AUTH_BYPASS_STORAGE_KEY,
  MOBILE_SELECTED_PROJECT_STORAGE_KEY,
  MOBILE_TOKEN_STORAGE_KEY,
} from "@ideahome/shared";

import { getDevWebUrlOverride } from "./dev-web-url";

/**
 * Web app URL for the in-app WebView. In __DEV__, uses localhost:3000 by default
 * (simulator) or the override from dev-web-url.ts (physical device: set to your Mac's
 * LAN URL, e.g. http://192.168.1.10:3000). Run `pnpm dev:web` so the web app is reachable.
 */
export const APP_WEB_URL =
  typeof __DEV__ !== "undefined" && __DEV__
    ? (getDevWebUrlOverride() ?? "http://localhost:3000")
    : IDEAHOME_WEB_ORIGIN;
export const APP_API_URL = IDEAHOME_API_ORIGIN;
export const TOKEN_STORAGE_KEY = MOBILE_TOKEN_STORAGE_KEY;
export const AUTH_BYPASS_STORAGE_KEY = MOBILE_AUTH_BYPASS_STORAGE_KEY;
export const ACTIVE_TAB_STORAGE_KEY = MOBILE_ACTIVE_TAB_STORAGE_KEY;
export const SELECTED_PROJECT_STORAGE_KEY = MOBILE_SELECTED_PROJECT_STORAGE_KEY;

export const TAB_ORDER_STORAGE_PREFIX = "ideahome_mobile_tab_order";
export const HIDDEN_TABS_STORAGE_PREFIX = "ideahome_mobile_hidden_tabs";

export const UI_TEST_PATTERNS = ["login", "issues", "comments", "attachments", "smoke"];
export const API_TEST_PATTERNS = ["issues", "projects", "comments", "expenses", "auth"];
export const EXPENSE_CATEGORIES = SHARED_EXPENSE_CATEGORIES;

/** Default tab order (built-in only; custom list tabs are appended when present). */
export const DEFAULT_TAB_ORDER = SHARED_DEFAULT_TAB_ORDER;

/**
 * Tabs hidden by default to align with web app (web has no Projects/Issues as main nav;
 * placeholders like Timeline, Calendar, Goals, Pages, Code Health are secondary).
 */
export const DEFAULT_HIDDEN_TAB_IDS: string[] = [
  "projects",
  "issues",
  "timeline",
  "calendar",
  "goals",
  "pages",
  "development",
];
