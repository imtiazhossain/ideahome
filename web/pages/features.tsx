import React, { useCallback } from "react";
import {
  createFeature,
  deleteFeature,
  fetchFeatures,
  isAuthenticated,
  reorderFeatures,
  updateFeature,
  type Feature,
} from "../lib/api";
import { createLegacyListStorage } from "../lib/legacyListStorage";
import { useCheckableProjectList } from "../lib/useCheckableProjectList";
import { useProjectLayout } from "../lib/useProjectLayout";
import { CheckableListPage } from "../components/CheckableListPage";
import { useTheme } from "./_app";

const featuresLegacyStorage = createLegacyListStorage(
  "ideahome-features-list",
  "ideahome-features-list"
);

export default function FeaturesPage() {
  const layout = useProjectLayout();
  const theme = useTheme();
  const list = useCheckableProjectList<Feature>({
    listType: "features",
    selectedProjectId: layout.selectedProjectId,
    authenticated: isAuthenticated(),
    fetchList: useCallback((projectId: string) => fetchFeatures(projectId), []),
    createItem: createFeature,
    updateItem: updateFeature,
    deleteItem: deleteFeature,
    reorderItems: reorderFeatures,
    legacyMigration: {
      load: () => featuresLegacyStorage.load(),
      create: createFeature,
      clear: () => featuresLegacyStorage.clear(),
    },
  });

  return (
    <CheckableListPage
      config={{
        title: "Features · Idea Home",
        activeTab: "list",
        pageTitle: "Features",
        itemLabel: "feature",
        listTitle: "Feature List",
        emptyMessage: "No features yet. Add one above.",
        addPlaceholder: "Feature name or description",
        addGuardMessage: "Select a project to add features.",
        listGuardMessage: "Select a project to see and manage features.",
        list,
        layout,
        theme,
      }}
    />
  );
}
