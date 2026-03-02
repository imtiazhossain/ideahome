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

export const APP_WEB_URL = IDEAHOME_WEB_ORIGIN;
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
