import { useCallback } from "react";
import { useUndoList } from "./useUndoList";
import {
  createOptimisticId,
  indexForNewUncheckedItem,
  insertUncheckedItem,
} from "./utils";
import { useCheckableUiState } from "./useCheckableUiState";

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
  const { pushHistory, undo, canUndo } = useUndoList(
    items,
    setItems as (items: T[]) => void,
    20,
    resetKey
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
  });

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
      applyToggleDone(index);
    },
    [applyToggleDone]
  );

  const removeItem = useCallback(
    (index: number, skipHistory?: boolean) => {
      applyRemove(index, skipHistory);
    },
    [applyRemove]
  );

  const saveEdit = useCallback(() => {
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
    cancelEdit();
  }, [
    editingIndex,
    editingValue,
    pushHistory,
    removeItem,
    setItems,
    cancelEdit,
  ]);

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      applyReorder(fromIndex, toIndex);
    },
    [applyReorder]
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
