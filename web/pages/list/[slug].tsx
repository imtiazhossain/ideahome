import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  adjustEditingIndexAfterRemove,
  adjustEditingIndexAfterReorder,
  createOptimisticId,
  indexForNewUncheckedItem,
  insertUncheckedItem,
  reorder,
  applyToggleDoneOrder,
} from "../../lib/utils";
import {
  getCustomListBySlug,
  getCustomListItems,
  setCustomListItems,
  type CustomListItem,
} from "../../lib/customLists";
import { useProjectLayout } from "../../lib/useProjectLayout";
import { getCustomListTabId } from "../../lib/customLists";
import { useUndoList } from "../../lib/useUndoList";
import { CheckableList } from "../../components/CheckableList";
import { AppLayout } from "../../components/AppLayout";
import { AddItemForm } from "../../components/AddItemForm";
import type { ProjectNavTabId } from "../../components/ProjectNavBar";
import { IconUndo } from "../../components/IconUndo";
import { useTheme } from "../_app";

export default function CustomListPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const layout = useProjectLayout();
  const {
    projects,
    projectsLoaded,
    selectedProjectId,
    setSelectedProjectId,
    drawerOpen,
    setDrawerOpen,
    editingProjectId,
    setEditingProjectId,
    editingProjectName,
    setEditingProjectName,
    projectNameInputRef,
    saveProjectName,
    cancelEditProjectName,
    projectToDelete,
    setProjectToDelete,
    projectDeleting,
    handleDeleteProject,
  } = layout;
  const { theme, toggleTheme } = useTheme();

  const list = slug ? getCustomListBySlug(slug) : null;
  const [items, setItems] = useState<CustomListItem[]>([]);
  const { pushHistory, undo, canUndo } = useUndoList(items, setItems, 20, slug);
  const [hydrated, setHydrated] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

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

  const persistItems = useCallback((next: CustomListItem[]) => {
    setItems(next);
  }, []);

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newItem.trim();
    if (!trimmed || !list) return;
    pushHistory();
    const newOne: CustomListItem = {
      id: createOptimisticId("local"),
      name: trimmed,
      done: false,
      order: indexForNewUncheckedItem(items),
    };
    persistItems(insertUncheckedItem(items, newOne));
    setNewItem("");
  };


  const toggleDone = (index: number) => {
    pushHistory();
    const item = items[index];
    const newDone = !item.done;
    let newIndex = 0;
    setItems((prev) => {
      const [reordered, idx] = applyToggleDoneOrder(prev, index, newDone);
      newIndex = idx;
      return reordered;
    });
    if (editingIndex === index) setEditingIndex(newIndex);
  };

  const removeItem = (index: number, skipHistory?: boolean) => {
    if (!skipHistory) pushHistory();
    setItems((prev) => prev.filter((_, i) => i !== index));
    setEditingIndex(adjustEditingIndexAfterRemove(editingIndex, index));
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(items[index]?.name ?? "");
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    pushHistory();
    const trimmed = editingValue.trim();
    if (trimmed) {
      setItems((prev) => {
        const next = [...prev];
        next[editingIndex] = { ...next[editingIndex], name: trimmed };
        return next;
      });
    } else {
      removeItem(editingIndex, true);
    }
    setEditingIndex(null);
  };

  const cancelEdit = () => setEditingIndex(null);

  const handleReorder = (fromIndex: number, toIndex: number) => {
    pushHistory();
    const reordered = reorder(items, fromIndex, toIndex);
    setItems(reordered);
    setEditingIndex(
      adjustEditingIndexAfterReorder(editingIndex, fromIndex, toIndex)
    );
  };

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

  const activeTab: ProjectNavTabId = getCustomListTabId(list.slug);

  return (
    <AppLayout
      title={`${list.name} · Idea Home`}
      activeTab={activeTab}
      projectName={
        projects.find((p) => p.id === selectedProjectId)?.name ??
        (selectedProjectId ? "Project" : list.name)
      }
      projectId={selectedProjectId || undefined}
      searchPlaceholder="Search"
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      projects={projects}
      selectedProjectId={selectedProjectId}
      setSelectedProjectId={setSelectedProjectId}
      editingProjectId={editingProjectId}
      setEditingProjectId={setEditingProjectId}
      editingProjectName={editingProjectName}
      setEditingProjectName={setEditingProjectName}
      saveProjectName={saveProjectName}
      cancelEditProjectName={cancelEditProjectName}
      projectNameInputRef={projectNameInputRef}
      theme={theme}
      toggleTheme={toggleTheme}
      projectToDelete={projectToDelete}
      setProjectToDelete={setProjectToDelete}
      projectDeleting={projectDeleting}
      handleDeleteProject={handleDeleteProject}
    >
      <div className="tests-page-content">
        <h1 className="tests-page-title">{list.name}</h1>

        <section className="tests-page-section">
          <AddItemForm
            value={newItem}
            onChange={setNewItem}
            onSubmit={addItem}
            placeholder="Add an item…"
            ariaLabel="New item"
            submitAriaLabel="Add item"
            submitTitle="Add item"
          />
        </section>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">
            List{" "}
            <span className="tests-page-section-count" aria-label="Count">
              {items.length}
            </span>
            {canUndo && (
              <button
                type="button"
                className="tests-page-section-undo"
                onClick={undo}
                aria-label="Undo last change"
                title="Undo"
              >
                <IconUndo />
                Undo
              </button>
            )}
          </h2>
          <CheckableList
            items={items}
            itemLabel="item"
            emptyMessage="No items yet. Add one above."
            loading={!hydrated}
            isItemDisabled={() => false}
            editingIndex={editingIndex}
            editingValue={editingValue}
            onEditingValueChange={setEditingValue}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            onToggleDone={toggleDone}
            onReorder={handleReorder}
            onDelete={removeItem}
          />
        </section>
      </div>
    </AppLayout>
  );
}
