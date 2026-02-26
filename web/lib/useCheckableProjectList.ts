import { useCallback } from "react";
import type { ListCacheKey } from "./listCache";
import { useCachedProjectList } from "./useCachedProjectList";
import { useUndoList } from "./useUndoList";
import {
  createOptimisticId,
  indexForNewUncheckedItem,
  insertUncheckedItem,
  isOptimisticId,
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

export interface UseCheckableProjectListOptions<T extends CheckableProjectItem> {
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
}: UseCheckableProjectListOptions<T>) {
  const projectId = selectedProjectId ?? "";
  const [items, setItems, loading] = useCachedProjectList<T>({
    listType,
    selectedProjectId: projectId,
    authenticated,
    fetchList,
    legacyMigration,
  });
  const { pushHistory, undo, canUndo } = useUndoList(
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
            reorderItems(
              projectId,
              withCreated.map((i) => i.id)
            )
              .then(setItems as (items: T[]) => void)
              .catch(() => {
                fetchList(projectId).then(setItems as (items: T[]) => void);
                onReorderError?.();
              });
          }
        })
        .catch((err) => {
          setItems((prev: T[]) =>
            prev.filter((i) => i.id !== optimisticId)
          );
          onAddError?.(err instanceof Error ? err : new Error(String(err)));
        });
    },
    [
      items,
      newItem,
      projectId,
      pushHistory,
      createItem,
      fetchList,
      reorderItems,
      setItems,
      onAddError,
      onReorderError,
    ]
  );

  const toggleDone = useCallback(
    (index: number) => {
      const item = items[index];
      if (isOptimisticId(item.id)) return;
      const newDone = !item.done;
      applyToggleDone(index);
      updateItem(item.id, { done: newDone }).catch(() => {
        if (!projectId) {
          setItems((prev: T[]) => [...prev]);
          return;
        }
        fetchList(projectId).then(setItems as (items: T[]) => void);
      });
    },
    [items, updateItem, applyToggleDone, projectId, fetchList, setItems]
  );

  const removeItem = useCallback(
    (index: number, skipHistory?: boolean) => {
      const item = items[index];
      if (isOptimisticId(item.id)) return;
      const removed = { ...item };
      applyRemove(index, skipHistory);
      deleteItem(item.id).catch(() => {
        setItems((prev: T[]) => [
          ...prev.slice(0, index),
          removed,
          ...prev.slice(index),
        ]);
      });
    },
    [items, applyRemove, deleteItem, setItems]
  );

  const saveEdit = useCallback(
    async () => {
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
    },
    [
      items,
      editingIndex,
      editingValue,
      pushHistory,
      updateItem,
      removeItem,
      setItems,
      cancelEdit,
    ]
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!projectId) return;
      const reordered = applyReorder(fromIndex, toIndex);
      reorderItems(projectId, reordered.map((i) => i.id))
        .then(setItems as (items: T[]) => void)
        .catch(() => {
          fetchList(projectId).then(setItems as (items: T[]) => void);
          onReorderError?.();
        });
    },
    [
      projectId,
      reorderItems,
      fetchList,
      setItems,
      onReorderError,
      applyReorder,
    ]
  );

  return {
    items,
    loading,
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
    pushHistory,
    undo,
    canUndo,
  };
}
