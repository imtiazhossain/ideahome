import { useCallback, useRef, useState } from "react";
import {
  adjustEditingIndexAfterRemove,
  adjustEditingIndexAfterReorder,
  applyToggleDoneOrder,
  reorder,
} from "./utils";

export interface CheckableUiItem {
  id: string;
  name: string;
  done: boolean;
}

export interface UseCheckableUiStateOptions<T extends CheckableUiItem> {
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  pushHistory: () => void;
  canEditItem?: (item: T | undefined) => boolean;
}

export function useCheckableUiState<T extends CheckableUiItem>({
  items,
  setItems,
  pushHistory,
  canEditItem,
}: UseCheckableUiStateOptions<T>) {
  const [newItem, setNewItem] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const lastUncheckedIndexByIdRef = useRef<Record<string, number>>({});

  const canEditAt = useCallback(
    (index: number): boolean => {
      if (!canEditItem) return true;
      return canEditItem(items[index]);
    },
    [canEditItem, items]
  );

  const startEdit = useCallback(
    (index: number) => {
      if (!canEditAt(index)) return;
      setEditingIndex(index);
      setEditingValue(items[index]?.name ?? "");
    },
    [canEditAt, items]
  );

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const applyToggleDone = useCallback(
    (index: number): { newIndex: number; reorderedItems: T[] } | null => {
      if (!canEditAt(index)) return null;
      const item = items[index];
      if (!item) return null;
      pushHistory();
      const newDone = !item.done;
      if (newDone) {
        lastUncheckedIndexByIdRef.current[item.id] = index;
      }
      const restoreIndex = !newDone
        ? lastUncheckedIndexByIdRef.current[item.id]
        : undefined;
      let newIndex = 0;
      let reorderedItems: T[] = [];
      setItems((prev: T[]) => {
        const [nextItems, idx] = applyToggleDoneOrder(
          prev,
          index,
          newDone,
          restoreIndex
        );
        newIndex = idx;
        reorderedItems = nextItems;
        return nextItems;
      });
      if (!newDone) {
        delete lastUncheckedIndexByIdRef.current[item.id];
      }
      if (editingIndex === index) setEditingIndex(newIndex);
      return { newIndex, reorderedItems };
    },
    [canEditAt, items, pushHistory, setItems, editingIndex]
  );

  const applyReorder = useCallback(
    (fromIndex: number, toIndex: number): T[] => {
      pushHistory();
      const reorderedItems = reorder(items, fromIndex, toIndex);
      setItems(reorderedItems);
      setEditingIndex(
        adjustEditingIndexAfterReorder(editingIndex, fromIndex, toIndex)
      );
      return reorderedItems;
    },
    [items, pushHistory, setItems, editingIndex]
  );

  const applyRemove = useCallback(
    (index: number, skipHistory?: boolean) => {
      if (!canEditAt(index)) return;
      if (!skipHistory) pushHistory();
      setItems((prev: T[]) => prev.filter((_, i) => i !== index));
      setEditingIndex(adjustEditingIndexAfterRemove(editingIndex, index));
    },
    [canEditAt, pushHistory, setItems, editingIndex]
  );

  return {
    newItem,
    setNewItem,
    editingIndex,
    setEditingIndex,
    editingValue,
    setEditingValue,
    startEdit,
    cancelEdit,
    applyToggleDone,
    applyReorder,
    applyRemove,
  };
}
