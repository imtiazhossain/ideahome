import { useEffect, useState } from "react";
import { AUTH_CHANGE_EVENT } from "./api/auth";
import {
  CUSTOM_TABS_CHANGED_EVENT,
  getCustomTabs,
  type CustomTab,
} from "./customTabs";

export function useCustomTabs(projectId: string): CustomTab[] {
  const [tabs, setTabs] = useState<CustomTab[]>([]);

  useEffect(() => {
    const sync = () => {
      setTabs(projectId ? getCustomTabs(projectId) : []);
    };
    sync();

    const onCustomTabsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (!detail?.projectId || detail.projectId === projectId) {
        sync();
      }
    };

    window.addEventListener(CUSTOM_TABS_CHANGED_EVENT, onCustomTabsChanged);
    window.addEventListener("storage", sync);
    window.addEventListener(AUTH_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener(CUSTOM_TABS_CHANGED_EVENT, onCustomTabsChanged);
      window.removeEventListener("storage", sync);
      window.removeEventListener(AUTH_CHANGE_EVENT, sync);
    };
  }, [projectId]);

  return tabs;
}
