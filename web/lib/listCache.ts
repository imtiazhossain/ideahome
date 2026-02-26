/**
 * In-memory cache for project list data (todos, ideas, enhancements, features, bugs).
 * Shows cached data instantly when revisiting a list or switching back to a project;
 * pages still refetch in the background to revalidate.
 */

export type ListCacheKey =
  | "todos"
  | "ideas"
  | "enhancements"
  | "features"
  | "bugs";

interface CacheEntry<T> {
  data: T[];
}

const cache = new Map<string, CacheEntry<unknown>>();

function key(listType: ListCacheKey, projectId: string): string {
  return `${listType}:${projectId}`;
}

export function getList<T>(
  listType: ListCacheKey,
  projectId: string
): T[] | undefined {
  const entry = cache.get(key(listType, projectId)) as
    | CacheEntry<T>
    | undefined;
  return entry?.data;
}

export function setList<T>(
  listType: ListCacheKey,
  projectId: string,
  data: T[]
): void {
  cache.set(key(listType, projectId), { data: [...data] });
}
