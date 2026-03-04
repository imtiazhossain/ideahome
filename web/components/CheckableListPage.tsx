import React, { useCallback, useState } from "react";
import { CheckableListPageShell } from "./CheckableListPageShell";
import { isOptimisticId } from "../lib/utils";
import { useCheckableProjectList } from "../lib/useCheckableProjectList";
import {
  useCheckableListAssistant,
  type UseCheckableListAssistantResult,
} from "../lib/useCheckableListAssistant";
import { useProjectLayout } from "../lib/useProjectLayout";
import { useTheme } from "../pages/_app";
import { isAuthenticated } from "../lib/api";
import {
  CHECKABLE_LIST_PAGES,
  type CheckableListPageKey,
} from "../config/checkableListPages";
import { IconIdeas } from "./icons";

export function CheckableListPage({
  pageKey,
}: {
  pageKey: CheckableListPageKey;
}) {
  const layout = useProjectLayout();
  const theme = useTheme();
  const def = CHECKABLE_LIST_PAGES[pageKey];
  const [addError, setAddError] = useState<string | null>(null);
  const [undoSyncToast, setUndoSyncToast] = useState<string | null>(null);

  React.useEffect(() => {
    if (!undoSyncToast) return;
    const timer = window.setTimeout(() => setUndoSyncToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [undoSyncToast]);

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
    onUndoSyncError: (message) => setUndoSyncToast(message),
  });

  const assistant = useCheckableListAssistant({
    items: list.items,
    listType: def.listType,
    selectedProjectId: layout.selectedProjectId,
  }) as unknown as UseCheckableListAssistantResult;

  const handleAddSubmit = useCallback(
    (e: React.FormEvent) => {
      if (def.showAddError) setAddError(null);
      list.addItem(e);
    },
    [def.showAddError, list]
  );

  const handleCopyList = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setUndoSyncToast("Copy is not supported in this browser.");
      return;
    }
    const text = list.items.map((item) => `- ${item.name}`).join("\n");
    if (!text) {
      setUndoSyncToast("List is empty.");
      return;
    }
    void navigator.clipboard
      .writeText(text)
      .then(() => setUndoSyncToast("List copied."))
      .catch(() => setUndoSyncToast("Could not copy list."));
  }, [list.items]);

  const { theme: themeValue, toggleTheme } = theme;

  const canBulkDelete = list.items.some(
    (item) => item.done && !isOptimisticId(item.id)
  );

  const handleBulkDelete = useCallback(async () => {
    const removedIds = new Set(
      list.items
        .filter((item) => item.done && !isOptimisticId(item.id))
        .map((item) => item.id)
    );
    await list.removeDoneItems();
    if (removedIds.size > 0) {
      assistant.pruneAssistantStateByIds(removedIds);
    }
  }, [list, assistant.pruneAssistantStateByIds]);

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
        onCreateProject: layout.createProjectByName,
        onRenameProject: layout.renameProjectById,
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
      onCopyList={handleCopyList}
      onSort={list.sortItems}
      currentSortMode={list.sortMode}
      sortDisabled={
        list.loading || list.items.some((item) => isOptimisticId(item.id))
      }
      copyListAriaLabel={`Copy ${def.listTitle}`}
      copyListTitle={`Copy ${def.listTitle} as bullet points`}
      canBulkDelete={canBulkDelete}
      onBulkDelete={handleBulkDelete}
      toastMessage={undoSyncToast}
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
        renderItemActions: (item) => {
          if (item.done) return null;
          const loading = Boolean(assistant.assistantLoadingById[item.id]);
          const hasChat =
            (assistant.assistantChatById[item.id]?.length ?? 0) > 0 ||
            Boolean(assistant.assistantGifById[item.id]);
          const isCollapsed = assistant.assistantCollapsedById[item.id] ?? true;
          const hasChatSession = Object.prototype.hasOwnProperty.call(
            assistant.assistantCollapsedById,
            item.id
          );
          return (
            <button
              type="button"
              className={`idea-plan-generate-btn${!isCollapsed ? " is-active" : ""}${(hasChat || hasChatSession) && isCollapsed ? " is-dimmed" : ""}${loading ? " is-thinking" : ""}`}
              onClick={() => {
                const willOpen = isCollapsed;
                assistant.setAssistantCollapsedById((prev: Record<string, boolean>) => ({
                  ...prev,
                  [item.id]: !isCollapsed,
                }));
                if (willOpen) {
                  assistant.setPendingFocusIdeaId(item.id);
                  if (!hasChat && !loading) {
                    void assistant.handleAssistantChatRequest(item.id);
                  }
                }
              }}
              disabled={isOptimisticId(item.id)}
              aria-label="AI Assistance"
              title="AI Assistance"
            >
              <IconIdeas />
            </button>
          );
        },
        renderItemDetails: (item) => assistant.renderIdeaDetails(item.id),
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
      errorMessage={list.error}
    />
  );
}
