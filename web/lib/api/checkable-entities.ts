import {
  pathChecklistItem,
  pathChecklistList,
  pathChecklistReorder,
} from "@ideahome/shared";

export type Todo = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

export type Idea = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
  planJson?: IdeaPlan | null;
  planGeneratedAt?: string | null;
};

export type IdeaPlan = {
  summary: string;
  milestones: string[];
  tasks: string[];
  risks: string[];
  firstSteps: string[];
};

export type IdeaAssistantChatResult = {
  ideaId: string;
  createdCount: number;
  todos: Todo[];
  previewGifUrl?: string | null;
  message?: string;
};

export type Bug = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

export type Feature = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

export type Enhancement = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

type CheckableEntity = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

type RequestJson = <T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    headers?: HeadersInit;
    errorMessage: string;
  }
) => Promise<T>;

type RequestVoid = (
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    headers?: HeadersInit;
    errorMessage: string;
  }
) => Promise<void>;

function createCheckableEntityApi<T extends CheckableEntity>(
  requestJson: RequestJson,
  requestVoid: RequestVoid,
  resource: "todos" | "ideas" | "bugs" | "features",
  singularLabel: "todo" | "idea" | "bug" | "feature",
  pluralLabel: "todos" | "ideas" | "bugs" | "features",
  reorderIdsKey: "todoIds" | "ideaIds" | "bugIds" | "featureIds"
) {
  return {
    async fetch(projectId: string): Promise<T[]> {
      return requestJson<T[]>(pathChecklistList(resource, projectId), {
        errorMessage: `Failed to fetch ${pluralLabel}`,
      });
    },
    async search(projectId: string, search: string): Promise<T[]> {
      if (!search.trim()) return [];
      return requestJson<T[]>(pathChecklistList(resource, projectId, search), {
        errorMessage: `Failed to search ${pluralLabel}`,
      });
    },
    async create(body: {
      projectId: string;
      name: string;
      done?: boolean;
    }): Promise<T> {
      return requestJson<T>(pathChecklistList(resource), {
        method: "POST",
        body,
        errorMessage: `Failed to create ${singularLabel}`,
      });
    },
    async update(
      id: string,
      data: { name?: string; done?: boolean; order?: number }
    ): Promise<T> {
      return requestJson<T>(pathChecklistItem(resource, id), {
        method: "PATCH",
        body: data,
        errorMessage: `Failed to update ${singularLabel}`,
      });
    },
    async remove(id: string): Promise<void> {
      return requestVoid(pathChecklistItem(resource, id), {
        method: "DELETE",
        errorMessage: `Failed to delete ${singularLabel}`,
      });
    },
    async reorder(projectId: string, ids: string[]): Promise<T[]> {
      const payload: Record<string, unknown> = { projectId };
      payload[reorderIdsKey] = ids;
      return requestJson<T[]>(pathChecklistReorder(resource), {
        method: "POST",
        body: payload,
        errorMessage: `Failed to reorder ${pluralLabel}`,
      });
    },
  };
}

const ENHANCEMENTS_STORAGE_PREFIX = "ideahome-enhancements-list";
const ENHANCEMENTS_STORAGE_LEGACY_KEY = "ideahome-enhancements-list";

function createEnhancementId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `enh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createCheckableApis(deps: {
  requestJson: RequestJson;
  requestVoid: RequestVoid;
  getUserScopedStorageKey: (prefix: string, legacyKey?: string) => string;
}) {
  const { requestJson, requestVoid, getUserScopedStorageKey } = deps;
  const todoApi = createCheckableEntityApi<Todo>(
    requestJson,
    requestVoid,
    "todos",
    "todo",
    "todos",
    "todoIds"
  );
  const ideaApi = createCheckableEntityApi<Idea>(
    requestJson,
    requestVoid,
    "ideas",
    "idea",
    "ideas",
    "ideaIds"
  );
  const bugApi = createCheckableEntityApi<Bug>(
    requestJson,
    requestVoid,
    "bugs",
    "bug",
    "bugs",
    "bugIds"
  );
  const featureApi = createCheckableEntityApi<Feature>(
    requestJson,
    requestVoid,
    "features",
    "feature",
    "features",
    "featureIds"
  );

  function getEnhancementsStorageKey(): string {
    return getUserScopedStorageKey(
      ENHANCEMENTS_STORAGE_PREFIX,
      ENHANCEMENTS_STORAGE_LEGACY_KEY
    );
  }

  function loadEnhancementsStore(): Enhancement[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(getEnhancementsStorageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is Enhancement =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as Enhancement).id === "string" &&
            typeof (item as Enhancement).name === "string" &&
            typeof (item as Enhancement).done === "boolean" &&
            typeof (item as Enhancement).order === "number" &&
            typeof (item as Enhancement).projectId === "string" &&
            typeof (item as Enhancement).createdAt === "string"
        )
      );
    } catch {
      return [];
    }
  }

  function saveEnhancementsStore(items: Enhancement[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(getEnhancementsStorageKey(), JSON.stringify(items));
    } catch {
      // ignore
    }
  }

  function sortEnhancementsByOrder(items: Enhancement[]): Enhancement[] {
    return [...items].sort((a, b) => a.order - b.order);
  }

  return {
    todoApi,
    ideaApi,
    bugApi,
    featureApi,
    async fetchEnhancements(projectId: string): Promise<Enhancement[]> {
      const all = loadEnhancementsStore();
      return sortEnhancementsByOrder(
        all.filter((item) => item.projectId === projectId)
      );
    },
    async createEnhancement(body: {
      projectId: string;
      name: string;
      done?: boolean;
    }): Promise<Enhancement> {
      const all = loadEnhancementsStore();
      const projectItems = all.filter((item) => item.projectId === body.projectId);
      const nextOrder =
        projectItems.length === 0
          ? 0
          : Math.max(...projectItems.map((item) => item.order)) + 1;
      const created: Enhancement = {
        id: createEnhancementId(),
        name: body.name,
        done: Boolean(body.done),
        order: nextOrder,
        projectId: body.projectId,
        createdAt: new Date().toISOString(),
      };
      saveEnhancementsStore([...all, created]);
      return created;
    },
    async updateEnhancement(
      id: string,
      data: { name?: string; done?: boolean; order?: number }
    ): Promise<Enhancement> {
      const all = loadEnhancementsStore();
      const idx = all.findIndex((item) => item.id === id);
      if (idx === -1) throw new Error("Enhancement not found");
      const current = all[idx];
      const updated: Enhancement = {
        ...current,
        ...(typeof data.name === "string" ? { name: data.name } : {}),
        ...(typeof data.done === "boolean" ? { done: data.done } : {}),
        ...(typeof data.order === "number" ? { order: data.order } : {}),
      };
      const next = [...all];
      next[idx] = updated;
      saveEnhancementsStore(next);
      return updated;
    },
    async deleteEnhancement(id: string): Promise<void> {
      const all = loadEnhancementsStore();
      const next = all.filter((item) => item.id !== id);
      saveEnhancementsStore(next);
    },
    async reorderEnhancements(
      projectId: string,
      ids: string[]
    ): Promise<Enhancement[]> {
      const all = loadEnhancementsStore();
      const projectItems = all.filter((item) => item.projectId === projectId);
      const byId = new Map(projectItems.map((item) => [item.id, item]));
      const uniqueIds = Array.from(new Set(ids)).filter((id) => byId.has(id));
      const missing = projectItems
        .map((item) => item.id)
        .filter((id) => !uniqueIds.includes(id));
      const orderedIds = [...uniqueIds, ...missing];
      const updatedProjectItems = orderedIds.map((id, order) => ({
        ...byId.get(id)!,
        order,
      }));
      const projectIdSet = new Set(projectItems.map((item) => item.id));
      const otherItems = all.filter((item) => !projectIdSet.has(item.id));
      const next = [...otherItems, ...updatedProjectItems];
      saveEnhancementsStore(next);
      return sortEnhancementsByOrder(updatedProjectItems);
    },
  };
}
