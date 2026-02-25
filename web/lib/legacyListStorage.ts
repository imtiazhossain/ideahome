import { getUserScopedStorageKey } from "./api";

export type LegacyListItem = { name: string; done: boolean };

function parseLegacyList(raw: string | null): LegacyListItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: unknown) => {
      if (
        item &&
        typeof item === "object" &&
        "name" in item &&
        typeof (item as { name: unknown }).name === "string"
      ) {
        const o = item as { name: string; done?: boolean };
        return { name: o.name, done: Boolean(o.done) };
      }
      return { name: String(item), done: false };
    });
  } catch {
    return [];
  }
}

/**
 * Helpers for one-time migration of legacy localStorage lists (array of { name, done }).
 * Each list uses a user-scoped key and a legacy key for pre-auth data.
 */
export function createLegacyListStorage(prefix: string, legacyKey: string) {
  function getKey(): string {
    return getUserScopedStorageKey(prefix, legacyKey);
  }

  function load(): LegacyListItem[] {
    if (typeof window === "undefined") return [];
    const key = getKey();
    let raw = localStorage.getItem(key);
    if (!raw && key !== legacyKey) raw = localStorage.getItem(legacyKey);
    return parseLegacyList(raw);
  }

  function clear(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(getKey());
    localStorage.removeItem(legacyKey);
  }

  return { getKey, load, clear };
}
