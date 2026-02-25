import { useCallback, useState } from "react";
import type { ListCacheKey } from "./listCache";
import { useCachedProjectList } from "./useCachedProjectList";
import { useUndoList } from "./useUndoList";
import {
  adjustEditingIndexAfterRemove,
  adjustEditingIndexAfterReorder,
  createOptimisticId,
  indexForNewUncheckedItem,
  insertUncheckedItem,
  isOptimisticId,
  reorder,
  applyToggleDoneOrder,
} from "./utils";

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
  const [newItem, setNewItem] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const { pushHistory, undo, canUndo } = useUndoList(
    items,
    setItems as (items: T[]) => void,
    20,
    projectId || undefined
  );

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
    async (index: number) => {
      const item = items[index];
      if (isOptimisticId(item.id)) return;
      pushHistory();
      const newDone = !item.done;
      try {
        await updateItem(item.id, { done: newDone });
        let newIndex = 0;
        setItems((prev: T[]) => {
          const [reordered, idx] = applyToggleDoneOrder(prev, index, newDone);
          newIndex = idx;
          return reordered;
        });
        if (editingIndex === index) setEditingIndex(newIndex);
      } catch {
        setItems((prev: T[]) => [...prev]);
      }
    },
    [items, editingIndex, pushHistory, updateItem, setItems]
  );

  const removeItem = useCallback(
    (index: number, skipHistory?: boolean) => {
      const item = items[index];
      if (isOptimisticId(item.id)) return;
      if (!skipHistory) pushHistory();
      const removed = { ...item };
      setItems((prev: T[]) => prev.filter((_, i) => i !== index));
      setEditingIndex(adjustEditingIndexAfterRemove(editingIndex, index));
      deleteItem(item.id).catch(() => {
        setItems((prev: T[]) => [
          ...prev.slice(0, index),
          removed,
          ...prev.slice(index),
        ]);
      });
    },
    [items, editingIndex, pushHistory, deleteItem, setItems]
  );

  const startEdit = useCallback(
    (index: number) => {
      if (isOptimisticId(items[index]?.id ?? "")) return;
      setEditingIndex(index);
      setEditingValue(items[index]?.name ?? "");
    },
    [items]
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
      setEditingIndex(null);
    },
    [items, editingIndex, editingValue, pushHistory, updateItem, removeItem, setItems]
  );

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!projectId) return;
      pushHistory();
      const reordered = reorder(items, fromIndex, toIndex);
      setItems(reordered);
      setEditingIndex(
        adjustEditingIndexAfterReorder(editingIndex, fromIndex, toIndex)
      );
      reorderItems(projectId, reordered.map((i) => i.id))
        .then(setItems as (items: T[]) => void)
        .catch(() => {
          fetchList(projectId).then(setItems as (items: T[]) => void);
          onReorderError?.();
        });
    },
    [
      items,
      editingIndex,
      projectId,
      pushHistory,
      reorderItems,
      fetchList,
      setItems,
      onReorderError,
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
