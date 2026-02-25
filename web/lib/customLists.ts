/**
 * Custom list pages (user-created list tabs). Stored in localStorage.
 * Lists are global (not project-scoped); items are simple { id, name, done, order }.
 */

import { getUserScopedStorageKey } from "./api";

const LISTS_KEY_PREFIX = "ideahome-custom-lists";
const LISTS_LEGACY_KEY = "ideahome-custom-lists";
const ITEMS_KEY_PREFIX = "ideahome-custom-list-items";

export interface CustomList {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
}

export interface CustomListItem {
  id: string;
  name: string;
  done: boolean;
  order: number;
}

function getListsKey(): string {
  return getUserScopedStorageKey(LISTS_KEY_PREFIX, LISTS_LEGACY_KEY);
}

function slugFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "list";
}

function uniqueSlug(base: string, existing: CustomList[]): string {
  let slug = base;
  let n = 0;
  const used = new Set(existing.map((l) => l.slug));
  while (used.has(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

export function getCustomLists(): CustomList[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getListsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomLists(lists: CustomList[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getListsKey(), JSON.stringify(lists));
  } catch {
    // ignore
  }
}

export function getCustomListBySlug(slug: string): CustomList | undefined {
  return getCustomLists().find((l) => l.slug === slug);
}

export function getCustomListTabId(slug: string): string {
  return `custom-${slug}`;
}

export function addCustomList(name: string): CustomList {
  const trimmed = name.trim() || "New list";
  const lists = getCustomLists();
  const baseSlug = slugFromName(trimmed);
  const slug = uniqueSlug(baseSlug, lists);
  const list: CustomList = {
    id: slug,
    slug,
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  lists.push(list);
  saveCustomLists(lists);
  return list;
}

export function deleteCustomList(slug: string): void {
  if (typeof window === "undefined") return;
  const lists = getCustomLists().filter((l) => l.slug !== slug);
  saveCustomLists(lists);
  const itemsKey = getUserScopedStorageKey(
    `${ITEMS_KEY_PREFIX}-${slug}`,
    `${ITEMS_KEY_PREFIX}-${slug}`
  );
  localStorage.removeItem(itemsKey);
}

function getItemsKey(slug: string): string {
  return getUserScopedStorageKey(
    `${ITEMS_KEY_PREFIX}-${slug}`,
    `${ITEMS_KEY_PREFIX}-${slug}`
  );
}

export function getCustomListItems(slug: string): CustomListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getItemsKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCustomListItems(slug: string, items: CustomListItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getItemsKey(slug), JSON.stringify(items));
  } catch {
    // ignore
  }
}
