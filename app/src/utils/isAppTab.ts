import type { AppTab } from "../types";

const APP_TABS: AppTab[] = [
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
  "settings",
];

export function isAppTab(value: string): value is AppTab {
  return APP_TABS.includes(value as AppTab);
}
