import { useCallback, useEffect, useRef, useState } from "react";
import type { ListCacheKey } from "./listCache";
import { useCachedProjectList } from "./useCachedProjectList";
import { useUndoList } from "./useUndoList";
import {
  createOptimisticId,
  indexForNewUncheckedItem,
  insertUncheckedItem,
  isOptimisticId,
  sortCheckableItems,
  type CheckableSortMode,
} from "./utils";
import { useCheckableUiState } from "./useCheckableUiState";

export interface CheckableProjectItem {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId?: string;
  createdAt?: string;
}

export interface UseCheckableProjectListOptions<
  T extends CheckableProjectItem,
> {
  listType: ListCacheKey;
  selectedProjectId: string | null;
  authenticated: boolean;
  fetchList: (projectId: string) => Promise<T[]>;
  createItem: (opts: {
    projectId: string;
    name: string;
    done?: boolean;
  }) => Promise<T>;
  updateItem: (
    id: string,
    data: { name?: string; done?: boolean; order?: number }
  ) => Promise<T>;
  deleteItem: (id: string) => Promise<void>;
  reorderItems: (projectId: string, ids: string[]) => Promise<T[]>;
  legacyMigration?: {
    load: () => { name: string; done: boolean }[];
    create: (opts: {
      projectId: string;
      name: string;
      done: boolean;
    }) => Promise<T>;
    clear: () => void;
  };
  onAddError?: (err: Error) => void;
  onReorderError?: () => void;
  onUndoSyncError?: (message: string) => void;
}

export function useCheckableProjectList<T extends CheckableProjectItem>({
  listType,
  selectedProjectId,
  authenticated,
  fetchList,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  legacyMigration,
  onAddError,
  onReorderError,
  onUndoSyncError,
}: UseCheckableProjectListOptions<T>) {
  const projectId = selectedProjectId ?? "";
  const toggleRequestVersionRef = useRef<Record<string, number>>({});
  const normalizationAttemptKeyRef = useRef<string>("");
  const [sortMode, setSortMode] = useState<CheckableSortMode | null>(null);
  const [items, setItems, loading, loadError] = useCachedProjectList<T>({
    listType,
    selectedProjectId: projectId,
    authenticated,
    fetchList,
    legacyMigration,
  });
  const {
    pushHistory,
    undo: undoInMemory,
    canUndo,
  } = useUndoList(
    items,
    setItems as (items: T[]) => void,
    20,
    projectId || undefined
  );
  const {
    newItem,
    setNewItem,
    editingIndex,
    editingValue,
    setEditingValue,
    startEdit,
    cancelEdit,
    applyToggleDone,
    applyReorder,
    applyRemove,
  } = useCheckableUiState<T>({
    items,
    setItems,
    pushHistory,
    canEditItem: (item) => !isOptimisticId(item?.id ?? ""),
  });

  const isUncheckedFirstOrder = useCallback((list: T[]): boolean => {
    let seenDone = false;
    for (const item of list) {
      if (item.done) {
        seenDone = true;
        continue;
      }
      if (seenDone) return false;
    }
    return true;
  }, []);

  const normalizeUncheckedFirst = useCallback((list: T[]): T[] => {
    const unchecked: T[] = [];
    const checked: T[] = [];
    list.forEach((item) => {
      if (item.done) checked.push(item);
      else unchecked.push(item);
    });
    return [...unchecked, ...checked];
  }, []);

  const refreshFromServer = useCallback(async (): Promise<T[] | null> => {
    if (!projectId) return null;
    const freshItems = await fetchList(projectId);
    setItems(freshItems);
    return freshItems;
  }, [projectId, fetchList, setItems]);

  const syncReorderOrRefresh = useCallback(
    async (ids: string[], opts?: { onError?: () => void }): Promise<void> => {
      if (!projectId) return;
      try {
        const reordered = await reorderItems(projectId, ids);
        setItems(reordered as T[]);
      } catch {
        await refreshFromServer();
        opts?.onError?.();
        onReorderError?.();
      }
    },
    [projectId, reorderItems, setItems, refreshFromServer, onReorderError]
  );

  useEffect(() => {
    if (!projectId) return;
    if (items.length < 2) return;
    if (items.some((item) => isOptimisticId(item.id))) return;
    if (isUncheckedFirstOrder(items)) {
      normalizationAttemptKeyRef.current = "";
      return;
    }
    const key = items.map((item) => `${item.id}:${item.done ? 1 : 0}`).join("|");
    if (normalizationAttemptKeyRef.current === key) return;
    normalizationAttemptKeyRef.current = key;
    const normalized = normalizeUncheckedFirst(items);
    setItems(normalized);
    void syncReorderOrRefresh(normalized.map((item) => item.id));
  }, [
    items,
    projectId,
    isUncheckedFirstOrder,
    normalizeUncheckedFirst,
    setItems,
    syncReorderOrRefresh,
  ]);

  useEffect(() => {
    normalizationAttemptKeyRef.current = "";
    setSortMode(null);
  }, [projectId]);

  const addItem = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = newItem.trim();
      if (!trimmed || !projectId) return;
      pushHistory();
      const optimisticId = createOptimisticId();
      const optimistic = {
        id: optimisticId,
        name: trimmed,
        done: false,
        order: indexForNewUncheckedItem(items),
        projectId: selectedProjectId,
        createdAt: new Date().toISOString(),
      } as T;
      const inserted = insertUncheckedItem(items, optimistic);
      setItems(inserted);
      setNewItem("");
      createItem({ projectId: projectId, name: trimmed, done: false })
        .then((created) => {
          setItems((prev: T[]) => {
            const idx = prev.findIndex((i) => i.id === optimisticId);
            if (idx === -1) return [...prev, created];
            const next = [...prev];
            next[idx] = created;
            return next;
          });
          if (indexForNewUncheckedItem(inserted) < inserted.length) {
            const withCreated = inserted.map((i) =>
              i.id === optimisticId ? created : i
            );
            void syncReorderOrRefresh(withCreated.map((i) => i.id));
          }
        })
        .catch((err) => {
          setItems((prev: T[]) => prev.filter((i) => i.id !== optimisticId));
          onAddError?.(err instanceof Error ? err : new Error(String(err)));
        });
    },
    [
      items,
      newItem,
      projectId,
      pushHistory,
      createItem,
      setItems,
      onAddError,
      syncReorderOrRefresh,
    ]
  );

  const toggleDone = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      if (isOptimisticId(item.id)) return;
      const newDone = !item.done;
      const requestVersion =
        (toggleRequestVersionRef.current[item.id] ?? 0) + 1;
      toggleRequestVersionRef.current[item.id] = requestVersion;
      const toggleResult = applyToggleDone(index);
      const reorderedIds = toggleResult?.reorderedItems.map((i) => i.id) ?? [];
      updateItem(item.id, { done: newDone })
        .then(() => {
          if (toggleRequestVersionRef.current[item.id] !== requestVersion) return;
          if (!projectId || reorderedIds.length === 0) return;
          return reorderItems(projectId, reorderedIds).then((reordered) => {
            if (toggleRequestVersionRef.current[item.id] !== requestVersion) return;
            setItems(reordered as T[]);
          });
        })
        .catch(() => {
          if (toggleRequestVersionRef.current[item.id] !== requestVersion)
            return;
          if (!projectId) {
            setItems((prev: T[]) => [...prev]);
            return;
          }
          void refreshFromServer();
        });
    },
    [
      items,
      updateItem,
      applyToggleDone,
      projectId,
      reorderItems,
      setItems,
      refreshFromServer,
    ]
  );

  const removeItem = useCallback(
    (index: number, skipHistory?: boolean) => {
      const item = items[index];
      if (isOptimisticId(item.id)) return;
      const removed = { ...item };
      applyRemove(index, skipHistory);
      deleteItem(item.id).catch(() => {
        setItems((prev: T[]) => {
          if (prev.some((current) => current.id === removed.id)) return prev;
          return [...prev, removed].sort((a, b) => a.order - b.order);
        });
      });
    },
    [items, applyRemove, deleteItem, setItems]
  );

  const saveEdit = useCallback(async () => {
    if (editingIndex === null) return;
    const item = items[editingIndex];
    if (isOptimisticId(item.id)) return;
    pushHistory();
    const trimmed = editingValue.trim();
    if (trimmed) {
      try {
        await updateItem(item.id, { name: trimmed });
        setItems((prev: T[]) => {
          const next = [...prev];
          next[editingIndex] = { ...next[editingIndex], name: trimmed };
          return next;
        });
      } catch {
        // keep previous name
      }
    } else {
      removeItem(editingIndex, true);
    }
    cancelEdit();
  }, [
    items,
    editingIndex,
    editingValue,
    pushHistory,
    updateItem,
    removeItem,
    setItems,
    cancelEdit,
  ]);

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!projectId) return;
      const reordered = applyReorder(fromIndex, toIndex);
      void syncReorderOrRefresh(reordered.map((i) => i.id));
    },
    [projectId, syncReorderOrRefresh, applyReorder]
  );

  const sortItems = useCallback(
    (mode: CheckableSortMode) => {
      if (!projectId) return;
      if (items.length < 2) return;
      if (items.some((item) => isOptimisticId(item.id))) return;
      pushHistory();
      const sorted = sortCheckableItems(items, mode);
      setItems(sorted);
      setSortMode(mode);
      void syncReorderOrRefresh(sorted.map((item) => item.id));
    },
    [items, projectId, pushHistory, setItems, syncReorderOrRefresh]
  );

  const patchItemById = useCallback(
    (id: string, patch: Partial<T>) => {
      setItems((prev: T[]) =>
        prev.map((item) =>
          item.id === id ? ({ ...item, ...patch } as T) : item
        )
      );
    },
    [setItems]
  );

  const removeDoneItems = useCallback(async (): Promise<number> => {
    const targets = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.done && !isOptimisticId(item.id));
    if (targets.length === 0) return 0;

    pushHistory();
    const targetIds = new Set(targets.map(({ item }) => item.id));
    const removedById = new Map(
      targets.map(({ item }) => [item.id, item] as const)
    );

    setItems((prev: T[]) => prev.filter((item) => !targetIds.has(item.id)));

    const results = await Promise.allSettled(
      targets.map(({ item }) => deleteItem(item.id))
    );
    const failedIds = targets
      .filter((_, idx) => results[idx].status === "rejected")
      .map(({ item }) => item.id);

    if (failedIds.length > 0) {
      const failedSet = new Set(failedIds);
      setItems((prev: T[]) => {
        const restored = failedIds
          .map((id) => removedById.get(id))
          .filter((item): item is T => Boolean(item));
        return [...prev, ...restored].sort((a, b) => a.order - b.order);
      });
      void refreshFromServer();
      return targets.length - failedSet.size;
    }

    return targets.length;
  }, [items, pushHistory, setItems, deleteItem, refreshFromServer]);

  const undo = useCallback(() => {
    const beforeUndo = items;
    const restored = undoInMemory();
    if (!restored || !projectId) return;

    const existingIds = new Set(beforeUndo.map((item) => item.id));
    const restoredDeletes = restored.filter(
      (item) => !existingIds.has(item.id) && !isOptimisticId(item.id)
    );
    if (restoredDeletes.length === 0) return;

    void (async () => {
      const recreatedPairs = await Promise.all(
        restoredDeletes.map(async (item) => {
          try {
            const recreated = await createItem({
              projectId,
              name: item.name,
              done: item.done,
            });
            return [item.id, recreated] as const;
          } catch {
            return null;
          }
        })
      );

      const recreatedMap = new Map<string, T>();
      recreatedPairs.forEach((entry) => {
        if (!entry) return;
        recreatedMap.set(entry[0], entry[1]);
      });

      if (recreatedMap.size !== restoredDeletes.length) {
        onUndoSyncError?.(
          "Undo restored locally, but sync was partial. Refreshed from server."
        );
        void refreshFromServer();
        return;
      }

      const reorderedIds = restored.map(
        (item) => recreatedMap.get(item.id)?.id ?? item.id
      );
      await syncReorderOrRefresh(reorderedIds, {
        onError: () =>
          onUndoSyncError?.(
            "Undo restored locally, but ordering sync failed. Refreshed from server."
          ),
      });
    })();
  }, [
    items,
    undoInMemory,
    projectId,
    createItem,
    refreshFromServer,
    syncReorderOrRefresh,
    onUndoSyncError,
  ]);

  return {
    items,
    loading,
    error: loadError,
    newItem,
    setNewItem,
    editingIndex,
    editingValue,
    setEditingValue,
    addItem,
    toggleDone,
    removeItem,
    startEdit,
    saveEdit,
    cancelEdit,
    handleReorder,
    sortItems,
    sortMode,
    patchItemById,
    removeDoneItems,
    pushHistory,
    undo,
    canUndo,
  };
}
