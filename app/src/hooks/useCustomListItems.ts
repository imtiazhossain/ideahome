import { useCallback, useEffect, useState } from "react";
import type { CustomListItem } from "../utils/customListsStorage";
import {
  getCustomListItems,
  setCustomListItems,
} from "../utils/customListsStorage";

function nextOrder(items: CustomListItem[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((i) => i.order), -1) + 1;
}

function createItem(name: string, order: number): CustomListItem {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    done: false,
    order,
  };
}

export function useCustomListItems(slug: string, userId: string) {
  const [items, setItemsState] = useState<CustomListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setItemsState([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCustomListItems(slug, userId)
      .then((data) => {
        if (!cancelled) setItemsState(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, userId]);

  useEffect(() => {
    if (!slug || loading) return;
    setCustomListItems(slug, userId, items).catch(() => {});
  }, [slug, userId, loading, items]);

  const setItems = useCallback((updater: CustomListItem[] | ((prev: CustomListItem[]) => CustomListItem[])) => {
    setItemsState(updater);
  }, []);

  const addItem = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setItemsState((prev) => {
      const order = nextOrder(prev);
      return [...prev, createItem(trimmed, order)].sort((a, b) => a.order - b.order);
    });
  }, []);

  const toggleDone = useCallback((item: CustomListItem) => {
    setItemsState((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i))
    );
  }, []);

  const removeItem = useCallback((item: CustomListItem) => {
    setItemsState((prev) => prev.filter((i) => i.id !== item.id));
  }, []);

  const updateItemName = useCallback((itemId: string, name: string) => {
    const trimmed = name.trim();
    setItemsState((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, name: trimmed || i.name } : i))
    );
  }, []);

  const reorder = useCallback((item: CustomListItem, direction: "up" | "down") => {
    setItemsState((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((i) => i.id === item.id);
      if (idx < 0) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      const aOrder = a.order;
      const bOrder = b.order;
      return sorted
        .map((i) => {
          if (i.id === a.id) return { ...i, order: bOrder };
          if (i.id === b.id) return { ...i, order: aOrder };
          return i;
        })
        .sort((x, y) => x.order - y.order);
    });
  }, []);

  return {
    items,
    loading,
    addItem,
    toggleDone,
    removeItem,
    updateItemName,
    reorder,
    setItems,
  };
}
