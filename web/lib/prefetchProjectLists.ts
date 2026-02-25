import { fetchBugs, fetchFeatures, fetchIdeas, fetchTodos } from "./api";
import { getList, setList, type ListCacheKey } from "./listCache";

const FETCHERS: {
  listType: ListCacheKey;
  fetch: (projectId: string) => Promise<unknown[]>;
}[] = [
  { listType: "todos", fetch: fetchTodos },
  { listType: "ideas", fetch: fetchIdeas },
  { listType: "features", fetch: fetchFeatures },
  { listType: "bugs", fetch: fetchBugs },
];

/**
 * Prefetch list data for a project and fill the cache. Skips list types
 * already in cache. Exclude the list type that is already being loaded.
 */
export function prefetchProjectLists(
  projectId: string,
  excludeListType?: ListCacheKey
): void {
  const toFetch = excludeListType
    ? FETCHERS.filter((f) => f.listType !== excludeListType)
    : FETCHERS;
  toFetch.forEach(({ listType, fetch: fetchFn }) => {
    if (getList(listType, projectId) !== undefined) return;
    fetchFn(projectId)
      .then((data) => setList(listType, projectId, data))
      .catch(() => {});
  });
}
