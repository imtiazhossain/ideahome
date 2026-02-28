/**
 * Single source of truth for Features, To-Do, Bugs, Ideas, and Enhancements pages.
 * Change any string, API, or behavior here — no need to touch page files.
 */
import type { ListCacheKey } from "../lib/listCache";
import type { ProjectNavTabId } from "../components/ProjectNavBar";
import { createLegacyListStorage } from "../lib/legacyListStorage";
import {
  createBug,
  createFeature,
  createEnhancement,
  createIdea,
  createTodo,
  deleteBug,
  deleteEnhancement,
  deleteFeature,
  deleteIdea,
  deleteTodo,
  fetchEnhancements,
  fetchBugs,
  fetchFeatures,
  fetchIdeas,
  fetchTodos,
  reorderEnhancements,
  reorderBugs,
  reorderFeatures,
  reorderIdeas,
  reorderTodos,
  updateEnhancement,
  updateBug,
  updateFeature,
  updateIdea,
  updateTodo,
  type Bug,
  type Enhancement,
  type Feature,
  type Idea,
  type Todo,
} from "../lib/api/checklists";

const featuresLegacy = createLegacyListStorage(
  "ideahome-features-list",
  "ideahome-features-list"
);
const todoLegacy = createLegacyListStorage(
  "ideahome-todo-list",
  "ideahome-todo-list"
);
const bugsLegacy = createLegacyListStorage(
  "ideahome-bugs-list",
  "ideahome-bugs-list"
);
const ideasLegacy = createLegacyListStorage(
  "ideahome-ideas-list",
  "ideahome-ideas-list"
);

export type CheckableListPageKey =
  | "features"
  | "todo"
  | "bugs"
  | "ideas"
  | "enhancements";

export interface CheckableListPageDef<T> {
  listType: ListCacheKey;
  title: string;
  activeTab: ProjectNavTabId;
  pageTitle: string;
  itemLabel: string;
  listTitle: string;
  emptyMessage: string;
  addPlaceholder: string;
  addGuardMessage: string;
  listGuardMessage: string;
  fetchList: (projectId: string) => Promise<T[]>;
  createItem: (opts: {
    projectId: string;
    name: string;
    done?: boolean;
  }) => Promise<T>;
  updateItem: (
    id: string,
    data: { name?: string; done?: boolean; order?: number }
  ) => Promise<T>;
  deleteItem: (id: string) => Promise<void>;
  reorderItems: (projectId: string, ids: string[]) => Promise<T[]>;
  legacyMigration: {
    load: () => { name: string; done: boolean }[];
    create: (opts: {
      projectId: string;
      name: string;
      done: boolean;
    }) => Promise<T>;
    clear: () => void;
  };
  showAddError?: boolean;
}

export const CHECKABLE_LIST_PAGES: Record<
  CheckableListPageKey,
  CheckableListPageDef<Feature | Todo | Bug | Idea | Enhancement>
> = {
  features: {
    listType: "features",
    title: "Features · IdeaHome",
    activeTab: "list",
    pageTitle: "Features",
    itemLabel: "feature",
    listTitle: "Feature List",
    emptyMessage: "No features yet. Add one above.",
    addPlaceholder: "Feature name or description",
    addGuardMessage: "Select a project to add features.",
    listGuardMessage: "Select a project to see and manage features.",
    fetchList: fetchFeatures,
    createItem: createFeature,
    updateItem: updateFeature,
    deleteItem: deleteFeature,
    reorderItems: reorderFeatures,
    legacyMigration: {
      load: () => featuresLegacy.load(),
      create: createFeature,
      clear: () => featuresLegacy.clear(),
    },
  },
  todo: {
    listType: "todos",
    title: "To-Do · IdeaHome",
    activeTab: "todo",
    pageTitle: "To-Do",
    itemLabel: "to-do",
    listTitle: "To-Do List",
    emptyMessage: "No to-dos yet. Add one above.",
    addPlaceholder: "To-do",
    addGuardMessage: "Select a project to add to-dos.",
    listGuardMessage: "Select a project to see and manage to-dos.",
    fetchList: fetchTodos,
    createItem: createTodo,
    updateItem: updateTodo,
    deleteItem: deleteTodo,
    reorderItems: reorderTodos,
    legacyMigration: {
      load: () => todoLegacy.load(),
      create: createTodo,
      clear: () => todoLegacy.clear(),
    },
    showAddError: true,
  },
  bugs: {
    listType: "bugs",
    title: "Bugs · IdeaHome",
    activeTab: "forms",
    pageTitle: "Bugs",
    itemLabel: "bug",
    listTitle: "Bug List",
    emptyMessage: "No bugs yet. Add one above.",
    addPlaceholder: "No one wants a broken bulb...",
    addGuardMessage: "Select a project to add bugs.",
    listGuardMessage: "Select a project to see and manage bugs.",
    fetchList: fetchBugs,
    createItem: createBug,
    updateItem: updateBug,
    deleteItem: deleteBug,
    reorderItems: reorderBugs,
    legacyMigration: {
      load: () => bugsLegacy.load(),
      create: createBug,
      clear: () => bugsLegacy.clear(),
    },
  },
  ideas: {
    listType: "ideas",
    title: "Ideas · IdeaHome",
    activeTab: "ideas",
    pageTitle: "Ideas",
    itemLabel: "idea",
    listTitle: "Ideas List",
    emptyMessage: "No ideas yet. Add one above.",
    addPlaceholder: "Idea",
    addGuardMessage: "Select a project to add ideas.",
    listGuardMessage: "Select a project to see and manage ideas.",
    fetchList: fetchIdeas,
    createItem: createIdea,
    updateItem: updateIdea,
    deleteItem: deleteIdea,
    reorderItems: reorderIdeas,
    legacyMigration: {
      load: () => ideasLegacy.load(),
      create: createIdea,
      clear: () => ideasLegacy.clear(),
    },
  },
  enhancements: {
    listType: "enhancements",
    title: "Enhancements · IdeaHome",
    activeTab: "enhancements",
    pageTitle: "Enhancements",
    itemLabel: "enhancement",
    listTitle: "Enhancements List",
    emptyMessage: "No enhancements yet. Add one above.",
    addPlaceholder: "Enhancement",
    addGuardMessage: "Select a project to add enhancements.",
    listGuardMessage: "Select a project to see and manage enhancements.",
    fetchList: fetchEnhancements,
    createItem: createEnhancement,
    updateItem: updateEnhancement,
    deleteItem: deleteEnhancement,
    reorderItems: reorderEnhancements,
    legacyMigration: {
      load: () => [],
      create: createEnhancement,
      clear: () => {},
    },
  },
};
