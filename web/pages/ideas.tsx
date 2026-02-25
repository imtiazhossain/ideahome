import React, { useCallback, useState } from "react";
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

const ideasLegacyStorage = createLegacyListStorage(
  "ideahome-ideas-list",
  "ideahome-ideas-list"
);

export default function IdeasPage() {
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
  } = layout;
  const { theme, toggleTheme } = useTheme();
  const [ideas, setIdeas, ideasLoading] = useCachedProjectList<Idea>({
    listType: "ideas",
    selectedProjectId,
    authenticated: isAuthenticated(),
    fetchList: useCallback((projectId: string) => fetchIdeas(projectId), []),
    legacyMigration: {
      load: () => ideasLegacyStorage.load(),
      create: createIdea,
      clear: () => ideasLegacyStorage.clear(),
    },
  });
  const [newIdea, setNewIdea] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const { pushHistory, undo, canUndo } = useUndoList(
    ideas,
    (items) => setIdeas(items),
    20,
    selectedProjectId ?? undefined
  );

  const isTempId = (id: string) => id.startsWith("temp-");

  const addIdea = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newIdea.trim();
    if (!trimmed || !selectedProjectId) return;
    pushHistory();
    const firstDoneIndex = ideas.findIndex((i) => i.done);
    const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Idea = {
      id: optimisticId,
      name: trimmed,
      done: false,
      order: firstDoneIndex === -1 ? ideas.length : firstDoneIndex,
      projectId: selectedProjectId,
      createdAt: new Date().toISOString(),
    };
    const inserted =
      firstDoneIndex === -1
        ? [...ideas, optimistic]
        : [
            ...ideas.slice(0, firstDoneIndex),
            optimistic,
            ...ideas.slice(firstDoneIndex),
          ];
    setIdeas(inserted);
    setNewIdea("");
    createIdea({
      projectId: selectedProjectId,
      name: trimmed,
      done: false,
    })
      .then((created) => {
        setIdeas((prev) => {
          const idx = prev.findIndex((i) => i.id === optimisticId);
          if (idx === -1) return [...prev, created];
          const next = [...prev];
          next[idx] = created;
          return next;
        });
        if (firstDoneIndex >= 0) {
          const withCreated = inserted.map((i) =>
            i.id === optimisticId ? created : i
          );
          reorderIdeas(
            selectedProjectId,
            withCreated.map((i) => i.id)
          )
            .then(setIdeas)
            .catch(() => fetchIdeas(selectedProjectId).then(setIdeas));
        }
      })
      .catch(() => {
        setIdeas((prev) => prev.filter((i) => i.id !== optimisticId));
      });
  };

  const toggleDone = async (index: number) => {
    const item = ideas[index];
    if (isTempId(item.id)) return;
    pushHistory();
    const newDone = !item.done;
    try {
      await updateIdea(item.id, { done: newDone });
      setIdeas((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], done: newDone };
        const without = next.filter((_, i) => i !== index);
        return newDone ? [...without, next[index]] : [next[index], ...without];
      });
      if (editingIndex === index) {
        setEditingIndex(newDone ? ideas.length - 1 : 0);
      }
    } catch {
      setIdeas((prev) => [...prev]);
    }
  };

  const removeIdea = (index: number, skipHistory?: boolean) => {
    const item = ideas[index];
    if (isTempId(item.id)) return;
    if (!skipHistory) pushHistory();
    const removed = { ...item };
    setIdeas((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index)
      setEditingIndex(editingIndex - 1);
    deleteIdea(item.id).catch(() => {
      setIdeas((prev) => [
        ...prev.slice(0, index),
        removed,
        ...prev.slice(index),
      ]);
    });
  };

  const startEdit = (index: number) => {
    if (isTempId(ideas[index]?.id ?? "")) return;
    setEditingIndex(index);
    setEditingValue(ideas[index]?.name ?? "");
  };

  const saveEdit = async () => {
    if (editingIndex === null) return;
    const item = ideas[editingIndex];
    if (isTempId(item.id)) return;
    pushHistory();
    const trimmed = editingValue.trim();
    if (trimmed) {
      try {
        await updateIdea(item.id, { name: trimmed });
        setIdeas((prev) => {
          const next = [...prev];
          next[editingIndex] = { ...next[editingIndex], name: trimmed };
          return next;
        });
      } catch {
        // keep previous name
      }
    } else {
      removeIdea(editingIndex, true);
    }
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    pushHistory();
    const reordered = reorder(ideas, fromIndex, toIndex);
    setIdeas(reordered);
    if (editingIndex !== null) {
      let newEditIndex = editingIndex;
      if (fromIndex === editingIndex) newEditIndex = toIndex;
      else if (fromIndex < editingIndex && toIndex >= editingIndex)
        newEditIndex = editingIndex - 1;
      else if (fromIndex > editingIndex && toIndex <= editingIndex)
        newEditIndex = editingIndex + 1;
      setEditingIndex(newEditIndex);
    }
    reorderIdeas(
      selectedProjectId,
      reordered.map((i) => i.id)
    )
      .then(setIdeas)
      .catch(() => setIdeas(ideas));
  };

  return (
    <AppLayout
      title="Ideas · Idea Home"
      activeTab="ideas"
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
    >
      <div className="tests-page-content">
        <h1 className="tests-page-title">Ideas</h1>

        <section className="tests-page-section">
          <ProjectSectionGuard
            projectsLoaded={projectsLoaded}
            selectedProjectId={selectedProjectId}
            message="Select a project to add ideas."
            variant="add"
          >
            <AddItemForm
              value={newIdea}
              onChange={setNewIdea}
              onSubmit={addIdea}
              placeholder="Idea item"
              ariaLabel="New idea"
              submitAriaLabel="Add idea"
              submitTitle="Add idea"
            />
          </ProjectSectionGuard>
        </section>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">
            Ideas List{" "}
            <span className="tests-page-section-count" aria-label="Count">
              {ideas.length}
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
            message="Select a project to see and manage ideas."
            variant="list"
          >
            <CheckableList
              items={ideas}
              itemLabel="idea"
              emptyMessage="No items yet. Add one above."
              loading={ideasLoading}
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
