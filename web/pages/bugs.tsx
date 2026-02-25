import React, { useCallback, useState } from "react";
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
import { reorder } from "../lib/utils";
import { useCachedProjectList } from "../lib/useCachedProjectList";
import { useUndoList } from "../lib/useUndoList";
import { useProjectLayout } from "../lib/useProjectLayout";
import { IconUndo } from "../components/IconUndo";
import { CheckableList } from "../components/CheckableList";
import { AppLayout } from "../components/AppLayout";
import { AddItemForm } from "../components/AddItemForm";
import { ProjectSectionGuard } from "../components/ProjectSectionGuard";
import { useTheme } from "./_app";

const bugsLegacyStorage = createLegacyListStorage(
  "ideahome-bugs-list",
  "ideahome-bugs-list"
);

export default function BugsPage() {
  const layout = useProjectLayout();
  const {
    projects,
    projectsLoaded,
    selectedProjectId,
    setSelectedProjectId,
    projectDisplayName,
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
  const [bugs, setBugs, bugsLoading] = useCachedProjectList<Bug>({
    listType: "bugs",
    selectedProjectId,
    authenticated: isAuthenticated(),
    fetchList: useCallback((projectId: string) => fetchBugs(projectId), []),
    legacyMigration: {
      load: () => bugsLegacyStorage.load(),
      create: createBug,
      clear: () => bugsLegacyStorage.clear(),
    },
  });
  const [newBug, setNewBug] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const { pushHistory, undo, canUndo } = useUndoList(
    bugs,
    (items) => setBugs(items),
    20,
    selectedProjectId ?? undefined
  );

  const isTempId = (id: string) => id.startsWith("temp-");

  const addBug = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBug.trim();
    if (!trimmed || !selectedProjectId) return;
    pushHistory();
    const firstDoneIndex = bugs.findIndex((b) => b.done);
    const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Bug = {
      id: optimisticId,
      name: trimmed,
      done: false,
      order: firstDoneIndex === -1 ? bugs.length : firstDoneIndex,
      projectId: selectedProjectId,
      createdAt: new Date().toISOString(),
    };
    const inserted =
      firstDoneIndex === -1
        ? [...bugs, optimistic]
        : [
            ...bugs.slice(0, firstDoneIndex),
            optimistic,
            ...bugs.slice(firstDoneIndex),
          ];
    setBugs(inserted);
    setNewBug("");
    createBug({
      projectId: selectedProjectId,
      name: trimmed,
      done: false,
    })
      .then((created) => {
        setBugs((prev) => {
          const idx = prev.findIndex((b) => b.id === optimisticId);
          if (idx === -1) return [...prev, created];
          const next = [...prev];
          next[idx] = created;
          return next;
        });
        if (firstDoneIndex >= 0) {
          const withCreated = inserted.map((b) =>
            b.id === optimisticId ? created : b
          );
          reorderBugs(
            selectedProjectId,
            withCreated.map((b) => b.id)
          )
            .then(setBugs)
            .catch(() => fetchBugs(selectedProjectId).then(setBugs));
        }
      })
      .catch(() => {
        setBugs((prev) => prev.filter((b) => b.id !== optimisticId));
      });
  };

  const toggleDone = async (index: number) => {
    const item = bugs[index];
    if (isTempId(item.id)) return;
    pushHistory();
    const newDone = !item.done;
    try {
      await updateBug(item.id, { done: newDone });
      setBugs((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], done: newDone };
        const without = next.filter((_, i) => i !== index);
        return newDone ? [...without, next[index]] : [next[index], ...without];
      });
      if (editingIndex === index) {
        setEditingIndex(newDone ? bugs.length - 1 : 0);
      }
    } catch {
      setBugs((prev) => [...prev]);
    }
  };

  const removeBug = (index: number, skipHistory?: boolean) => {
    const item = bugs[index];
    if (isTempId(item.id)) return;
    if (!skipHistory) pushHistory();
    const removed = { ...item };
    setBugs((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index)
      setEditingIndex(editingIndex - 1);
    deleteBug(item.id).catch(() => {
      setBugs((prev) => [
        ...prev.slice(0, index),
        removed,
        ...prev.slice(index),
      ]);
    });
  };

  const startEdit = (index: number) => {
    if (isTempId(bugs[index]?.id ?? "")) return;
    setEditingIndex(index);
    setEditingValue(bugs[index]?.name ?? "");
  };

  const saveEdit = async () => {
    if (editingIndex === null) return;
    const item = bugs[editingIndex];
    if (isTempId(item.id)) return;
    pushHistory();
    const trimmed = editingValue.trim();
    if (trimmed) {
      try {
        await updateBug(item.id, { name: trimmed });
        setBugs((prev) => {
          const next = [...prev];
          next[editingIndex] = { ...next[editingIndex], name: trimmed };
          return next;
        });
      } catch {
        // keep previous name
      }
    } else {
      removeBug(editingIndex, true);
    }
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    pushHistory();
    const reordered = reorder(bugs, fromIndex, toIndex);
    setBugs(reordered);
    if (editingIndex !== null) {
      let newEditIndex = editingIndex;
      if (fromIndex === editingIndex) newEditIndex = toIndex;
      else if (fromIndex < editingIndex && toIndex >= editingIndex)
        newEditIndex = editingIndex - 1;
      else if (fromIndex > editingIndex && toIndex <= editingIndex)
        newEditIndex = editingIndex + 1;
      setEditingIndex(newEditIndex);
    }
    reorderBugs(
      selectedProjectId,
      reordered.map((b) => b.id)
    )
      .then(setBugs)
      .catch(() => setBugs(bugs));
  };

  return (
    <AppLayout
      title="Bugs · Idea Home"
      activeTab="forms"
      projectName={projectDisplayName}
      projectId={selectedProjectId || undefined}
      searchPlaceholder="Search project"
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
        <h1 className="tests-page-title">Bugs</h1>

        <section className="tests-page-section">
          <ProjectSectionGuard
            projectsLoaded={projectsLoaded}
            selectedProjectId={selectedProjectId}
            message="Select a project to add bugs."
            variant="add"
          >
            <AddItemForm
              value={newBug}
              onChange={setNewBug}
              onSubmit={addBug}
              placeholder="Bug name or description"
              ariaLabel="New bug"
              submitAriaLabel="Add bug"
              submitTitle="Add bug"
            />
          </ProjectSectionGuard>
        </section>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">
            Bug List{" "}
            <span className="tests-page-section-count" aria-label="Count">
              {bugs.length}
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
          <ProjectSectionGuard
            projectsLoaded={projectsLoaded}
            selectedProjectId={selectedProjectId}
            message="Select a project to see and manage bugs."
            variant="list"
          >
            <CheckableList
              items={bugs}
              itemLabel="bug"
              emptyMessage="No bugs yet. Add one above."
              loading={bugsLoading}
              isItemDisabled={(item) => isTempId(item.id)}
              editingIndex={editingIndex}
              editingValue={editingValue}
              onEditingValueChange={setEditingValue}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onToggleDone={toggleDone}
              onReorder={handleReorder}
            />
          </ProjectSectionGuard>
        </section>
      </div>
    </AppLayout>
  );
}
