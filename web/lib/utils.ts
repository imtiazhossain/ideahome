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
