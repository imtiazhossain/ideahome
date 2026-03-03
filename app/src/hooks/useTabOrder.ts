import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { readUserIdFromToken } from "../utils/auth";
import { isAppTab } from "../utils/isAppTab";
import { getCustomListTabId, type CustomList } from "../utils/customListsStorage";
import {
  DEFAULT_HIDDEN_TAB_IDS,
  DEFAULT_TAB_ORDER,
  HIDDEN_TABS_STORAGE_PREFIX,
  TAB_ORDER_STORAGE_PREFIX,
} from "../constants";
import type { AppTab } from "../types";

export function useTabOrder(
  token: string,
  customLists: CustomList[],
  activeTab: AppTab,
  setActiveTab: (tab: AppTab) => void
) {
  const [tabOrder, setTabOrderState] = useState<AppTab[]>(() => [...DEFAULT_TAB_ORDER]);
  const [hiddenTabIds, setHiddenTabIdsState] = useState<string[]>(
    () => [...DEFAULT_HIDDEN_TAB_IDS]
  );

  useEffect(() => {
    const userId = readUserIdFromToken(token);
    const orderKey = userId ? `${TAB_ORDER_STORAGE_PREFIX}_${userId}` : TAB_ORDER_STORAGE_PREFIX;
    const hiddenKey = userId ? `${HIDDEN_TABS_STORAGE_PREFIX}_${userId}` : HIDDEN_TABS_STORAGE_PREFIX;
    Promise.all([
      AsyncStorage.getItem(orderKey),
      AsyncStorage.getItem(hiddenKey),
    ])
      .then(([storedOrder, storedHidden]) => {
        if (storedOrder) {
          try {
            const parsed = JSON.parse(storedOrder) as string[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTabOrderState(parsed.filter((id): id is AppTab => isAppTab(id)));
            }
          } catch {
            // ignore
          }
        }
        if (storedHidden) {
          try {
            const parsed = JSON.parse(storedHidden) as string[];
            if (Array.isArray(parsed)) {
              setHiddenTabIdsState(parsed.filter((id) => typeof id === "string"));
            }
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    const userId = readUserIdFromToken(token);
    const orderKey = userId ? `${TAB_ORDER_STORAGE_PREFIX}_${userId}` : TAB_ORDER_STORAGE_PREFIX;
    const hiddenKey = userId ? `${HIDDEN_TABS_STORAGE_PREFIX}_${userId}` : HIDDEN_TABS_STORAGE_PREFIX;
    AsyncStorage.setItem(orderKey, JSON.stringify(tabOrder)).catch(() => {});
    AsyncStorage.setItem(hiddenKey, JSON.stringify(hiddenTabIds)).catch(() => {});
  }, [token, tabOrder, hiddenTabIds]);

  const setTabOrder = useCallback((order: AppTab[]) => {
    setTabOrderState(order);
  }, []);

  const setHiddenTabIds = useCallback((ids: string[] | ((prev: string[]) => string[])) => {
    setHiddenTabIdsState(ids);
  }, []);

  const fullTabOrder = useMemo(() => {
    const order = tabOrder.filter(
      (id) =>
        !id.startsWith("custom-") ||
        customLists.some((l) => getCustomListTabId(l.slug) === id)
    );
    customLists.forEach((l) => {
      const id = getCustomListTabId(l.slug);
      if (!order.includes(id)) {
        const settingsIdx = order.indexOf("settings");
        order.splice(settingsIdx >= 0 ? settingsIdx : order.length, 0, id);
      }
    });
    return order;
  }, [tabOrder, customLists]);

  const visibleTabOrder = useMemo(
    () => fullTabOrder.filter((id) => !hiddenTabIds.includes(id)),
    [fullTabOrder, hiddenTabIds]
  );

  useEffect(() => {
    if (hiddenTabIds.includes(activeTab) && visibleTabOrder.length > 0) {
      setActiveTab(visibleTabOrder[0]);
    }
  }, [activeTab, hiddenTabIds, visibleTabOrder, setActiveTab]);

  return {
    tabOrder,
    setTabOrder,
    hiddenTabIds,
    setHiddenTabIds,
    fullTabOrder,
    visibleTabOrder,
  };
}
