import React, { useCallback } from "react";
import {
  createBug,
  deleteBug,
  fetchBugs,
  isAuthenticated,
  reorderBugs,
  updateBug,
  type Bug,
} from "../lib/api";
import { createLegacyListStorage } from "../lib/legacyListStorage";
import { useCheckableProjectList } from "../lib/useCheckableProjectList";
import { useProjectLayout } from "../lib/useProjectLayout";
import { CheckableListPage } from "../components/CheckableListPage";
import { useTheme } from "./_app";

const bugsLegacyStorage = createLegacyListStorage(
  "ideahome-bugs-list",
  "ideahome-bugs-list"
);

export default function BugsPage() {
  const layout = useProjectLayout();
  const theme = useTheme();
  const list = useCheckableProjectList<Bug>({
    listType: "bugs",
    selectedProjectId: layout.selectedProjectId,
    authenticated: isAuthenticated(),
    fetchList: useCallback((projectId: string) => fetchBugs(projectId), []),
    createItem: createBug,
    updateItem: updateBug,
    deleteItem: deleteBug,
    reorderItems: reorderBugs,
    legacyMigration: {
      load: () => bugsLegacyStorage.load(),
      create: createBug,
      clear: () => bugsLegacyStorage.clear(),
    },
  });

  return (
    <CheckableListPage
      config={{
        title: "Bugs · Idea Home",
        activeTab: "forms",
        pageTitle: "Bugs",
        itemLabel: "bug",
        listTitle: "Bug List",
        emptyMessage: "No bugs yet. Add one above.",
        addPlaceholder: "Bug name or description",
        addGuardMessage: "Select a project to add bugs.",
        listGuardMessage: "Select a project to see and manage bugs.",
        list,
        layout,
        theme,
      }}
    />
  );
}
