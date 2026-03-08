import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  getCustomListItems,
  setCustomListItems,
  getCustomTabBySlug,
  getCustomTabId,
  type CustomListItem,
} from "../../lib/customTabs";
import { useProjectLayout } from "../../lib/useProjectLayout";
import { useTheme } from "../_app";
import { useLocalCheckableList } from "../../lib/useLocalCheckableList";
import { CheckableListPageShell } from "../../components/CheckableListPageShell";

export default function CustomListPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const layout = useProjectLayout();
  const theme = useTheme();
  const projectId = layout.selectedProjectId ?? "";
  const list =
    slug && projectId ? getCustomTabBySlug(projectId, slug) : null;

  const [items, setItems] = useState<CustomListItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !projectId) return;
    const found = getCustomTabBySlug(projectId, slug);
    if (!found) return;
    setItems(getCustomListItems(projectId, slug));
    setHydrated(true);
  }, [projectId, slug]);

  useEffect(() => {
    if (!slug || !projectId || !hydrated) return;
    setCustomListItems(projectId, slug, items);
  }, [projectId, slug, hydrated, items]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const listState = useLocalCheckableList({
    items,
    setItems,
    resetKey: slug,
    idPrefix: "local",
  });

  const handleCopyList = React.useCallback(() => {
    if (!list) {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setToastMessage("Copy is not supported in this browser.");
      return;
    }
    const text = listState.items.map((item) => `- ${item.name}`).join("\n");
    if (!text) {
      setToastMessage("List is empty.");
      return;
    }
    void navigator.clipboard
      .writeText(text)
      .then(() => setToastMessage("List copied."))
      .catch(() => setToastMessage("Could not copy list."));
  }, [list, listState.items]);

  if (!router.isReady) return null;
  if (slug && !list) {
    return (
      <div className="app-layout">
        <main className="main-content">
          <div style={{ padding: 24 }}>
            <h1>List Not Found</h1>
            <p>The list &quot;{slug}&quot; does not exist.</p>
            <a href="/">Go home</a>
          </div>
        </main>
      </div>
    );
  }

  if (!list) return null;

  const activeTab = getCustomTabId(list.slug);
  const { theme: themeValue, toggleTheme } = theme;

  return (
    <CheckableListPageShell
      appLayoutProps={{
        title: `${list.name} · Idea Home`,
        activeTab,
        projectName:
          layout.projects.find((p) => p.id === layout.selectedProjectId)
            ?.name ?? (layout.selectedProjectId ? "Project" : list.name),
        projectId: layout.selectedProjectId || undefined,
        searchPlaceholder: "Search",
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
      pageTitle={list.name}
      addFormProps={{
        value: listState.newItem,
        onChange: listState.setNewItem,
        onSubmit: listState.addItem,
        placeholder: "Add…",
        ariaLabel: "New entry",
        submitAriaLabel: "Add entry",
        submitTitle: "Add entry",
      }}
      listTitle="List"
      itemCount={listState.items.length}
      canUndo={listState.canUndo}
      onUndo={listState.undo}
      onCopyList={handleCopyList}
      onSort={listState.sortItems}
      currentSortMode={listState.sortMode}
      sortDisabled={!hydrated || listState.items.length < 2}
      copyListAriaLabel={`Copy ${list.name}`}
      copyListTitle={`Copy ${list.name} as bullet points`}
      toastMessage={toastMessage}
      checkableListProps={{
        items: listState.items,
        itemLabel: "entry",
        emptyMessage: "It's dark in here...\nTurn the lights on by adding something.",
        loading: !hydrated,
        isItemDisabled: () => false,
        editingIndex: listState.editingIndex,
        editingValue: listState.editingValue,
        onEditingValueChange: listState.setEditingValue,
        onStartEdit: listState.startEdit,
        onSaveEdit: listState.saveEdit,
        onCancelEdit: listState.cancelEdit,
        onToggleDone: listState.toggleDone,
        onReorder: listState.handleReorder,
        onDelete: listState.removeItem,
      }}
    />
  );
}
