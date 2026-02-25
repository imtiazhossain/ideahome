import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MAX_HISTORY = 20;

/**
 * Hook for undo support on list state.
 * Call pushHistory() before each mutation; call undo() to restore the previous state.
 * Pass resetKey (e.g. list slug) to clear history when switching context.
 */
export function useUndoList<T>(
  items: T[],
  setItems: (items: T[]) => void,
  maxHistory = DEFAULT_MAX_HISTORY,
  resetKey?: string
) {
  const historyRef = useRef<T[][]>([]);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    if (resetKey !== undefined) {
      historyRef.current = [];
      setCanUndo(false);
    }
  }, [resetKey]);

  const pushHistory = useCallback(() => {
    const clone = JSON.parse(JSON.stringify(items)) as T[];
    historyRef.current.push(clone);
    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift();
    }
    setCanUndo(historyRef.current.length > 0);
  }, [items, maxHistory]);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setItems(prev);
    setCanUndo(historyRef.current.length > 0);
  }, [setItems]);

  return { pushHistory, undo, canUndo };
}
