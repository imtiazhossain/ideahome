import { useCallback, useState } from "react";
import { useUndoList } from "./useUndoList";
import {
  adjustEditingIndexAfterRemove,
  adjustEditingIndexAfterReorder,
  createOptimisticId,
  indexForNewUncheckedItem,
  insertUncheckedItem,
  reorder,
  applyToggleDoneOrder,
} from "./utils";

export interface LocalCheckableItem {
  id: string;
  name: string;
  done: boolean;
  order: number;
}

export interface UseLocalCheckableListOptions<T extends LocalCheckableItem> {
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  resetKey?: string;
  idPrefix?: string;
}

export function useLocalCheckableList<T extends LocalCheckableItem>({
  items,
  setItems,
  resetKey,
  idPrefix = "local",
}: UseLocalCheckableListOptions<T>) {
  const [newItem, setNewItem] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const { pushHistory, undo, canUndo } = useUndoList(
    items,
    setItems as (items: T[]) => void,
    20,
    resetKey
  );

  const addItem = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = newItem.trim();
      if (!trimmed) return;
      pushHistory();
      const newOne = {
        id: createOptimisticId(idPrefix),
        name: trimmed,
        done: false,
        order: indexForNewUncheckedItem(items),
      } as T;
      setItems(insertUncheckedItem(items, newOne));
      setNewItem("");
    },
    [items, newItem, idPrefix, pushHistory, setItems]
  );

  const toggleDone = useCallback(
    (index: number) => {
      pushHistory();
      const item = items[index];
      const newDone = !item.done;
      let newIndex = 0;
      setItems((prev: T[]) => {
        const [reordered, idx] = applyToggleDoneOrder(prev, index, newDone);
        newIndex = idx;
        return reordered;
      });
      if (editingIndex === index) setEditingIndex(newIndex);
    },
    [items, editingIndex, pushHistory, setItems]
  );

  const removeItem = useCallback(
    (index: number, skipHistory?: boolean) => {
      if (!skipHistory) pushHistory();
      setItems((prev: T[]) => prev.filter((_, i) => i !== index));
      setEditingIndex(adjustEditingIndexAfterRemove(editingIndex, index));
    },
    [editingIndex, pushHistory, setItems]
  );

  const startEdit = useCallback((index: number) => {
    setEditingIndex(index);
    setEditingValue(items[index]?.name ?? "");
  }, [items]);

  const saveEdit = useCallback(
    () => {
      if (editingIndex === null) return;
      pushHistory();
      const trimmed = editingValue.trim();
      if (trimmed) {
        setItems((prev: T[]) => {
          const next = [...prev];
          next[editingIndex] = { ...next[editingIndex], name: trimmed };
          return next;
        });
      } else {
        removeItem(editingIndex, true);
      }
      setEditingIndex(null);
    },
    [editingIndex, editingValue, pushHistory, removeItem, setItems]
  );

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      pushHistory();
      const reordered = reorder(items, fromIndex, toIndex);
      setItems(reordered);
      setEditingIndex(
        adjustEditingIndexAfterReorder(editingIndex, fromIndex, toIndex)
      );
    },
    [items, editingIndex, pushHistory, setItems]
  );

  return {
    items,
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
    undo,
    canUndo,
  };
}
