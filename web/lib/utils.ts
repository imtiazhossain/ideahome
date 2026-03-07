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
 * Index where a new unchecked item should be inserted (top of list).
 */
export function indexForNewUncheckedItem<T extends { done: boolean }>(
  _items: T[]
): number {
  return 0;
}

/**
 * Insert a new item at the position given by indexForNewUncheckedItem (top of list).
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

/** Format a Date as YYYY-MM-DD (local date, no timezone shift). */
export function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format number as USD currency. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/** Normalize UI-oriented text into more natural speech input for TTS engines. */
export function formatTextForSpeech(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "";

  const monthNameByAbbreviation: Record<string, string> = {
    Jan: "January",
    Feb: "February",
    Mar: "March",
    Apr: "April",
    Jun: "June",
    Jul: "July",
    Aug: "August",
    Sep: "September",
    Sept: "September",
    Oct: "October",
    Nov: "November",
    Dec: "December",
  };

  function humanizeSpeechLine(line: string): string {
    let result = line;

    result = result.replace(
      /\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2}),\s+(\d{4})\b/g,
      (_, month: string, day: string, year: string) =>
        `${monthNameByAbbreviation[month] ?? month} ${day}, ${year}`
    );

    result = result.replace(
      /\b([A-Z][a-z]+ \d{1,2}, \d{4})\s+(\d{1,2}:\d{2}\s?(?:AM|PM))\s*:\s*/g,
      "$1 at $2. "
    );

    result = result.replace(
      /\b(\d{1,2}:\d{2}\s?(?:AM|PM))\s*:\s*/g,
      "$1. "
    );

    return result.replace(/\s+/g, " ").trim();
  }

  function humanizeUnits(line: string): string {
    let result = line;

    // "38F" or "38 F" -> "38 degrees Fahrenheit"
    result = result.replace(
      /\b(\d+)\s*F\b/g,
      "$1 degrees Fahrenheit"
    );

    // "38C" or "38 C" -> "38 degrees Celsius"
    result = result.replace(
      /\b(\d+)\s*C\b/g,
      "$1 degrees Celsius"
    );

    // "6 mph" -> "6 miles per hour"
    result = result.replace(
      /\b(\d+)\s*mph\b/g,
      "$1 miles per hour"
    );

    return result;
  }

  return lines
    .map((line) => {
      const withoutBullet = line.replace(/^[-*•]\s+/, "").trim();
      if (!withoutBullet) return "";
      let speechLine = humanizeSpeechLine(withoutBullet);
      speechLine = humanizeUnits(speechLine);
      if (/:$/.test(speechLine)) {
        return `${speechLine.slice(0, -1)}.`;
      }
      if (/[.!?]$/.test(speechLine)) return speechLine;
      return `${speechLine}.`;
    })
    .filter(Boolean)
    .join(" ");
}

/** Format an ISO date string as relative time (e.g. "2 min ago", "yesterday"). */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const now = new Date();
  const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day} days ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/** Reorder array: move item from index `from` to index `to`. */
export function reorder<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [removed] = copy.splice(from, 1);
  copy.splice(to, 0, removed);
  return copy;
}

export type CheckableSortMode =
  | "name-asc"
  | "name-desc"
  | "created-desc"
  | "created-asc";

/**
 * Sort checkable items while keeping unchecked items above checked items.
 */
export function sortCheckableItems<
  T extends { name: string; done: boolean; createdAt?: string },
>(items: T[], mode: CheckableSortMode): T[] {
  const collator = new Intl.Collator(undefined, {
    sensitivity: "base",
    numeric: true,
  });
  const factor = mode === "name-asc" ? 1 : mode === "name-desc" ? -1 : 0;
  const withIndex = items.map((item, index) => ({ item, index }));
  return withIndex
    .sort((a, b) => {
      if (a.item.done !== b.item.done) return a.item.done ? 1 : -1;
      if (mode === "created-desc" || mode === "created-asc") {
        const aTime = Date.parse(a.item.createdAt ?? "");
        const bTime = Date.parse(b.item.createdAt ?? "");
        const aValid = Number.isFinite(aTime);
        const bValid = Number.isFinite(bTime);
        if (aValid && bValid) {
          if (aTime !== bTime) {
            return mode === "created-desc" ? bTime - aTime : aTime - bTime;
          }
        } else if (aValid !== bValid) {
          return aValid ? -1 : 1;
        }
      }
      if (factor !== 0) {
        const byName = collator.compare(a.item.name, b.item.name);
        if (byName !== 0) return byName * factor;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.item);
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
