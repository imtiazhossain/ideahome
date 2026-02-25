import { useEffect, useRef, useState } from "react";
import { prefetchProjectLists } from "./prefetchProjectLists";
import { getList, setList, type ListCacheKey } from "./listCache";

export interface LegacyMigration<T> {
  load: () => { name: string; done: boolean }[];
  create: (opts: {
    projectId: string;
    name: string;
    done: boolean;
  }) => Promise<T>;
  clear: () => void;
}

export interface UseCachedProjectListOptions<T extends { id: string }> {
  listType: ListCacheKey;
  selectedProjectId: string;
  authenticated: boolean;
  fetchList: (projectId: string) => Promise<T[]>;
  legacyMigration?: LegacyMigration<T>;
}

/**
 * Loads a project-scoped list with in-memory cache: shows cached data instantly
 * when revisiting, refetches in background. Syncs mutations back to cache.
 */
export function useCachedProjectList<T extends { id: string }>({
  listType,
  selectedProjectId,
  authenticated,
  fetchList,
  legacyMigration,
}: UseCachedProjectListOptions<T>): [
  T[],
  React.Dispatch<React.SetStateAction<T[]>>,
  boolean
] {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const migratedRef = useRef(false);

  const legacyMigrationRef = useRef(legacyMigration);
  legacyMigrationRef.current = legacyMigration;

  useEffect(() => {
    if (!authenticated || !selectedProjectId) {
      setItems([]);
      return;
    }
    const cached = getList<T>(listType, selectedProjectId);
    if (cached !== undefined) {
      setItems(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    prefetchProjectLists(selectedProjectId, listType);
    let cancelled = false;
    const migration = legacyMigrationRef.current;
    fetchList(selectedProjectId)
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setList(listType, selectedProjectId, data);
        if (
          migration &&
          !migratedRef.current &&
          data.length === 0 &&
          migration.load().length > 0
        ) {
          migratedRef.current = true;
          const legacy = migration.load();
          Promise.all(
            legacy.map((item) =>
              migration.create({
                projectId: selectedProjectId,
                name: item.name,
                done: item.done,
              })
            )
          )
            .then((created) => {
              if (cancelled) return;
              setItems(created);
              setList(listType, selectedProjectId, created);
              migration.clear();
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listType, selectedProjectId, authenticated, fetchList]);

  useEffect(() => {
    if (
      !selectedProjectId ||
      items.some((item) => item.id.startsWith("temp-"))
    )
      return;
    setList(listType, selectedProjectId, items);
  }, [listType, selectedProjectId, items]);

  return [items, setItems, loading];
}
