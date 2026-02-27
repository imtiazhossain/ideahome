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

/**
 * Compute display name for the selected project (avoids "Select a project" flash during loading).
 */
export function getProjectDisplayName(
  projects: { id: string; name: string }[],
  selectedProjectId: string,
  lastKnownProjectName?: string,
  projectsLoaded = true
): string {
  const found = projects.find((p) => p.id === selectedProjectId)?.name;
  if (found) return found;
  if (selectedProjectId && lastKnownProjectName) return lastKnownProjectName;
  if (selectedProjectId) return "Project";
  return projectsLoaded && projects.length ? "Select a project" : "Project";
}

/** Parse test cases from stored string (JSON array or legacy plain text). */
export function parseTestCases(raw: string | null | undefined): string[] {
  if (!raw) return [""];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(String);
  } catch {
    // not JSON — treat legacy plain-text value as a single test case
  }
  return [raw];
}

/** Serialize test cases to string for storage. */
export function serializeTestCases(cases: string[]): string | null {
  if (cases.length === 0) return null;
  if (cases.length === 1 && cases[0].trim() === "") return null;
  return JSON.stringify(cases);
}

/** Parse automated test names from stored string (JSON array or legacy single value). */
export function parseAutomatedTests(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // not JSON — treat as single test name
  }
  return raw ? [raw] : [];
}

/** Serialize automated test names to string for storage. */
export function serializeAutomatedTests(tests: string[]): string | null {
  if (tests.length === 0) return null;
  return JSON.stringify(tests);
}

/**
 * Infer recording kind from video URL filename (e.g. -audio.webm, -camera.webm, -screen.webm).
 */
export function getRecordingKindFromUrl(
  url: string
): "audio" | "camera" | "screen" | null {
  if (url.includes("-audio.webm")) return "audio";
  if (url.includes("-camera.webm")) return "camera";
  if (url.includes("-screen.webm")) return "screen";
  return null;
}

/**
 * Resolve recording kind from recording object (URL, mediaType, recordingType).
 */
export function getRecordingKind(rec: {
  videoUrl?: string | null;
  mediaType?: string | null;
  recordingType?: string | null;
}): "audio" | "screen" | "camera" {
  const url = rec.videoUrl ?? "";
  const fromUrl = getRecordingKindFromUrl(url);
  const isAudio = rec.mediaType === "audio" || fromUrl === "audio";
  if (isAudio) return "audio";
  const rt = rec.recordingType;
  const fromRec = rt === "screen" || rt === "camera" ? rt : undefined;
  const result = (fromUrl as "screen" | "camera" | null) ?? fromRec ?? "screen";
  return result as "audio" | "screen" | "camera";
}

/**
 * Default display label for a recording by kind and index.
 */
export function getRecordingDisplayLabel(
  kind: "audio" | "screen" | "camera",
  index: number
): string {
  if (kind === "audio") return `Audio Recording ${index}`;
  if (kind === "camera") return `Camera Recording ${index}`;
  return `Screen Recording ${index}`;
}

/** Format number as USD currency. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount);
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
  const result = [
    ...without.slice(0, insertAt),
    item,
    ...without.slice(insertAt),
  ];
  return [result, insertAt];
}

/**
 * Apply reorder when toggling done. Returns [reordered array, new index of toggled item].
 */
export function applyToggleDoneOrder<T extends { done: boolean }>(
  items: T[],
  index: number,
  newDone: boolean,
  restoreIndex?: number
): [T[], number] {
  const next = items.map((item, i) =>
    i === index ? { ...item, done: newDone } : item
  );
  const without = next.filter((_, i) => i !== index);
  if (newDone) {
    // Keep all unchecked items first; newly checked item becomes the first item in checked area.
    const firstDoneIdx = without.findIndex((i) => i.done);
    const insertAt = firstDoneIdx === -1 ? without.length : firstDoneIdx;
    const result = [
      ...without.slice(0, insertAt),
      next[index],
      ...without.slice(insertAt),
    ];
    return [result, insertAt];
  }
  if (typeof restoreIndex === "number" && Number.isFinite(restoreIndex)) {
    const firstDoneIdx = without.findIndex((i) => i.done);
    const uncheckedCount = firstDoneIdx === -1 ? without.length : firstDoneIdx;
    const insertAt = Math.max(
      0,
      Math.min(Math.trunc(restoreIndex), uncheckedCount)
    );
    const result = [
      ...without.slice(0, insertAt),
      next[index],
      ...without.slice(insertAt),
    ];
    return [result, insertAt];
  }
  return moveToUncheckedBottom(next, index);
}
