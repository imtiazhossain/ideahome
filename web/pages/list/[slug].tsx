import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  getCustomListBySlug,
  getCustomListItems,
  setCustomListItems,
  getCustomListTabId,
  type CustomListItem,
} from "../../lib/customLists";
import { useProjectLayout } from "../../lib/useProjectLayout";
import { useTheme } from "../_app";
import { useLocalCheckableList } from "../../lib/useLocalCheckableList";
import { CheckableListPageShell } from "../../components/CheckableListPageShell";

export default function CustomListPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const layout = useProjectLayout();
  const theme = useTheme();
  const list = slug ? getCustomListBySlug(slug) : null;

  const [items, setItems] = useState<CustomListItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    const found = getCustomListBySlug(slug);
    if (!found) return;
    setItems(getCustomListItems(slug));
    setHydrated(true);
  }, [slug]);

  useEffect(() => {
    if (!slug || !hydrated) return;
    setCustomListItems(slug, items);
  }, [slug, hydrated, items]);

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

  if (!router.isReady) return null;
  if (slug && !list) {
    return (
      <div className="app-layout">
        <main className="main-content">
          <div style={{ padding: 24 }}>
            <h1>List not found</h1>
            <p>The list &quot;{slug}&quot; does not exist.</p>
            <a href="/">Go home</a>
          </div>
        </main>
      </div>
    );
  }

  if (!list) return null;

  const activeTab = getCustomListTabId(list.slug);
  const { theme: themeValue, toggleTheme } = theme;

  const handleCopyList = React.useCallback(() => {
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
  }, [listState.items]);

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
      copyListAriaLabel={`Copy ${list.name}`}
      copyListTitle={`Copy ${list.name} as bullet points`}
      toastMessage={toastMessage}
      checkableListProps={{
        items: listState.items,
        itemLabel: "entry",
        emptyMessage: "No entries yet. Add one above.",
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
