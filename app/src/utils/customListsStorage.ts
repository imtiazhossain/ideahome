/**
 * Custom list storage (AsyncStorage). Mirrors web lib/customLists.ts.
 * Lists are global (not project-scoped). Items: { id, name, done, order }.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

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

/** User-scoped storage key. When userId is empty, use legacy key. */
function getListsKey(userId: string): string {
  return userId ? `${LISTS_KEY_PREFIX}-${userId}` : LISTS_LEGACY_KEY;
}

function getItemsKey(slug: string, userId: string): string {
  const base = `${ITEMS_KEY_PREFIX}-${slug}`;
  return userId ? `${base}-${userId}` : base;
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

export async function getCustomLists(userId: string): Promise<CustomList[]> {
  try {
    const raw = await AsyncStorage.getItem(getListsKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CustomList[]) : [];
  } catch {
    return [];
  }
}

async function saveCustomLists(userId: string, lists: CustomList[]): Promise<void> {
  try {
    await AsyncStorage.setItem(getListsKey(userId), JSON.stringify(lists));
  } catch {
    // ignore
  }
}

export function getCustomListTabId(slug: string): `custom-${string}` {
  return `custom-${slug}`;
}

export function getCustomListBySlug(lists: CustomList[], slug: string): CustomList | undefined {
  return lists.find((l) => l.slug === slug);
}

export async function addCustomList(userId: string, name: string): Promise<CustomList> {
  const trimmed = name.trim() || "New list";
  const lists = await getCustomLists(userId);
  const baseSlug = slugFromName(trimmed);
  const slug = uniqueSlug(baseSlug, lists);
  const list: CustomList = {
    id: slug,
    slug,
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  lists.push(list);
  await saveCustomLists(userId, lists);
  return list;
}

export async function deleteCustomList(userId: string, slug: string): Promise<void> {
  const lists = (await getCustomLists(userId)).filter((l) => l.slug !== slug);
  await saveCustomLists(userId, lists);
  await AsyncStorage.removeItem(getItemsKey(slug, userId));
}

export async function getCustomListItems(slug: string, userId: string): Promise<CustomListItem[]> {
  try {
    const raw = await AsyncStorage.getItem(getItemsKey(slug, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CustomListItem[]) : [];
  } catch {
    return [];
  }
}

export async function setCustomListItems(
  slug: string,
  userId: string,
  items: CustomListItem[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(getItemsKey(slug, userId), JSON.stringify(items));
  } catch {
    // ignore
  }
}
