import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MAX_HISTORY = 20;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hasNetChanges<T>(current: T, baseline: T): boolean {
  return JSON.stringify(current) !== JSON.stringify(baseline);
}

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
  const baselineRef = useRef<T[]>(deepClone(items));
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    historyRef.current = [];
    baselineRef.current = deepClone(items);
    setCanUndo(false);
  }, [resetKey]);

  useEffect(() => {
    if (historyRef.current.length === 0) {
      baselineRef.current = deepClone(items);
      setCanUndo(false);
      return;
    }
    setCanUndo(hasNetChanges(items, baselineRef.current));
  }, [items]);

  const pushHistory = useCallback(() => {
    const clone = deepClone(items);
    historyRef.current.push(clone);
    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift();
    }
    setCanUndo(hasNetChanges(items, baselineRef.current));
  }, [items, maxHistory]);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return null;
    setItems(prev);
    setCanUndo(hasNetChanges(prev, baselineRef.current));
    return prev;
  }, [setItems]);

  return { pushHistory, undo, canUndo };
}
