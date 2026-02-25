import React, { useCallback } from "react";
import {
  createIdea,
  deleteIdea,
  fetchIdeas,
  isAuthenticated,
  reorderIdeas,
  updateIdea,
  type Idea,
} from "../lib/api";
import { createLegacyListStorage } from "../lib/legacyListStorage";
import { useCheckableProjectList } from "../lib/useCheckableProjectList";
import { useProjectLayout } from "../lib/useProjectLayout";
import { CheckableListPage } from "../components/CheckableListPage";
import { useTheme } from "./_app";

const ideasLegacyStorage = createLegacyListStorage(
  "ideahome-ideas-list",
  "ideahome-ideas-list"
);

export default function IdeasPage() {
  const layout = useProjectLayout();
  const theme = useTheme();
  const list = useCheckableProjectList<Idea>({
    listType: "ideas",
    selectedProjectId: layout.selectedProjectId,
    authenticated: isAuthenticated(),
    fetchList: useCallback((projectId: string) => fetchIdeas(projectId), []),
    createItem: createIdea,
    updateItem: updateIdea,
    deleteItem: deleteIdea,
    reorderItems: reorderIdeas,
    legacyMigration: {
      load: () => ideasLegacyStorage.load(),
      create: createIdea,
      clear: () => ideasLegacyStorage.clear(),
    },
  });

  return (
    <CheckableListPage
      config={{
        title: "Ideas · Idea Home",
        activeTab: "ideas",
        pageTitle: "Ideas",
        itemLabel: "idea",
        listTitle: "Ideas List",
        emptyMessage: "No items yet. Add one above.",
        addPlaceholder: "Idea item",
        addGuardMessage: "Select a project to add ideas.",
        listGuardMessage: "Select a project to see and manage ideas.",
        list,
        layout,
        theme,
      }}
    />
  );
}
