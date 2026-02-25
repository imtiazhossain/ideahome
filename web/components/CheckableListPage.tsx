import React, { useCallback, useState } from "react";
import { CheckableList } from "./CheckableList";
import { CheckableListPageShell } from "./CheckableListPageShell";
import { isOptimisticId } from "../lib/utils";
import { useCheckableProjectList } from "../lib/useCheckableProjectList";
import { useProjectLayout } from "../lib/useProjectLayout";
import { useTheme } from "../pages/_app";
import { isAuthenticated } from "../lib/api";
import {
  CHECKABLE_LIST_PAGES,
  type CheckableListPageKey,
} from "../config/checkableListPages";

export function CheckableListPage({ pageKey }: { pageKey: CheckableListPageKey }) {
  const layout = useProjectLayout();
  const theme = useTheme();
  const def = CHECKABLE_LIST_PAGES[pageKey];
  const [addError, setAddError] = useState<string | null>(null);

  const list = useCheckableProjectList({
    listType: def.listType,
    selectedProjectId: layout.selectedProjectId,
    authenticated: isAuthenticated(),
    fetchList: useCallback(
      (projectId: string) => def.fetchList(projectId),
      [def]
    ),
    createItem: def.createItem,
    updateItem: def.updateItem,
    deleteItem: def.deleteItem,
    reorderItems: def.reorderItems,
    legacyMigration: def.legacyMigration,
    ...(def.showAddError && {
      onAddError: (err) =>
        setAddError(err.message || "Failed to add item. Try again."),
      onReorderError: () =>
        setAddError("Order could not be saved. Item was added."),
    }),
  });

  const handleAddSubmit = useCallback(
    (e: React.FormEvent) => {
      if (def.showAddError) setAddError(null);
      list.addItem(e);
    },
    [def.showAddError, list.addItem]
  );

  const { theme: themeValue, toggleTheme } = theme;

  return (
    <CheckableListPageShell
      appLayoutProps={{
        title: def.title,
        activeTab: def.activeTab,
        projectName: layout.projectDisplayName,
        projectId: layout.selectedProjectId || undefined,
        searchPlaceholder: "Search project",
        drawerOpen: layout.drawerOpen,
        setDrawerOpen: layout.setDrawerOpen,
        projects: layout.projects,
        selectedProjectId: layout.selectedProjectId ?? "",
        setSelectedProjectId: layout.setSelectedProjectId,
        editingProjectId: layout.editingProjectId,
        setEditingProjectId: layout.setEditingProjectId,
        editingProjectName: layout.editingProjectName,
        setEditingProjectName: layout.setEditingProjectName,
        saveProjectName: layout.saveProjectName,
        cancelEditProjectName: layout.cancelEditProjectName,
        projectNameInputRef: layout.projectNameInputRef,
        theme: themeValue,
        toggleTheme,
        projectToDelete: layout.projectToDelete,
        setProjectToDelete: layout.setProjectToDelete,
        projectDeleting: layout.projectDeleting,
        handleDeleteProject: layout.handleDeleteProject,
      }}
      pageTitle={def.pageTitle}
      addFormProps={{
        value: list.newItem,
        onChange: list.setNewItem,
        onSubmit: def.showAddError ? handleAddSubmit : list.addItem,
        placeholder: def.addPlaceholder,
        ariaLabel: `New ${def.itemLabel}`,
        submitAriaLabel: `Add ${def.itemLabel}`,
        submitTitle: `Add ${def.itemLabel}`,
        ...(def.showAddError && {
          error: addError,
          onClearError: () => setAddError(null),
        }),
      }}
      listTitle={def.listTitle}
      itemCount={list.items.length}
      canUndo={list.canUndo}
      onUndo={list.undo}
      checkableListProps={{
        items: list.items,
        itemLabel: def.itemLabel,
        emptyMessage: def.emptyMessage,
        loading: list.loading,
        isItemDisabled: (item) => isOptimisticId(item.id),
        editingIndex: list.editingIndex,
        editingValue: list.editingValue,
        onEditingValueChange: list.setEditingValue,
        onStartEdit: list.startEdit,
        onSaveEdit: list.saveEdit,
        onCancelEdit: list.cancelEdit,
        onToggleDone: list.toggleDone,
        onReorder: list.handleReorder,
        onDelete: list.removeItem,
      }}
      addGuard={{
        projectsLoaded: layout.projectsLoaded,
        selectedProjectId: layout.selectedProjectId ?? "",
        message: def.addGuardMessage,
      }}
      listGuard={{
        projectsLoaded: layout.projectsLoaded,
        selectedProjectId: layout.selectedProjectId ?? "",
        message: def.listGuardMessage,
      }}
    />
  );
}
