/** Create an optimistic ID for items not yet persisted. */
export function createOptimisticId(prefix = "temp"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Check if an ID is an optimistic (not-yet-persisted) ID. */
export function isOptimisticId(id: string, prefix = "temp"): boolean {
  return id.startsWith(`${prefix}-`);
}

/**
 * Compute new editing index after reordering. Returns null if not editing.
 */
export function adjustEditingIndexAfterReorder(
  editingIndex: number | null,
  fromIndex: number,
  toIndex: number
): number | null {
  if (editingIndex === null) return null;
  if (fromIndex === editingIndex) return toIndex;
  if (fromIndex < editingIndex && toIndex >= editingIndex)
    return editingIndex - 1;
  if (fromIndex > editingIndex && toIndex <= editingIndex)
    return editingIndex + 1;
  return editingIndex;
}

/**
 * Compute new editing index after removing an item. Returns null if not editing.
 */
export function adjustEditingIndexAfterRemove(
  editingIndex: number | null,
  removedIndex: number
): number | null {
  if (editingIndex === null) return null;
  if (editingIndex === removedIndex) return null;
  if (editingIndex > removedIndex) return editingIndex - 1;
  return editingIndex;
}

/**
 * Index where a new unchecked item should be inserted (before first done item).
 */
export function indexForNewUncheckedItem<T extends { done: boolean }>(
  items: T[]
): number {
  const firstDoneIndex = items.findIndex((i) => i.done);
  return firstDoneIndex === -1 ? items.length : firstDoneIndex;
}

/**
 * Insert a new item at the correct position (before first done item).
 */
export function insertUncheckedItem<T extends { done: boolean }>(
  items: T[],
  newItem: T
): T[] {
  const insertAt = indexForNewUncheckedItem(items);
  return insertAt === items.length
    ? [...items, newItem]
    : [...items.slice(0, insertAt), newItem, ...items.slice(insertAt)];
}

/** Reorder array: move item from index `from` to index `to`. */
export function reorder<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [removed] = copy.splice(from, 1);
  copy.splice(to, 0, removed);
  return copy;
}

/**
 * Move an unchecked item to the bottom of the unchecked section.
 * Use when toggling done from true to false — item goes to end of unchecked, not top.
 * Returns [reordered array, index where item was placed].
 */
function moveToUncheckedBottom<T extends { done: boolean }>(
  items: T[],
  index: number
): [T[], number] {
  const item = items[index];
  const without = items.filter((_, i) => i !== index);
  const firstDoneIdx = without.findIndex((i) => i.done);
  const insertAt = firstDoneIdx === -1 ? without.length : firstDoneIdx;
  const result = [...without.slice(0, insertAt), item, ...without.slice(insertAt)];
  return [result, insertAt];
}

/**
 * Apply reorder when toggling done. Returns [reordered array, new index of toggled item].
 */
export function applyToggleDoneOrder<T extends { done: boolean }>(
  items: T[],
  index: number,
  newDone: boolean
): [T[], number] {
  const next = items.map((item, i) =>
    i === index ? { ...item, done: newDone } : item
  );
  const without = next.filter((_, i) => i !== index);
  if (newDone) return [[...without, next[index]], without.length];
  return moveToUncheckedBottom(next, index);
}
