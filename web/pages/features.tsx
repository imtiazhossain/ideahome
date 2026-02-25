import React, { useCallback, useState } from "react";
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
import { reorder, applyToggleDoneOrder } from "../lib/utils";
import { useCachedProjectList } from "../lib/useCachedProjectList";
import { useUndoList } from "../lib/useUndoList";
import { useProjectLayout } from "../lib/useProjectLayout";
import { CheckableList } from "../components/CheckableList";
import { AppLayout } from "../components/AppLayout";
import { AddItemForm } from "../components/AddItemForm";
import { ProjectSectionGuard } from "../components/ProjectSectionGuard";
import { IconUndo } from "../components/IconUndo";
import { useTheme } from "./_app";

const featuresLegacyStorage = createLegacyListStorage(
  "ideahome-features-list",
  "ideahome-features-list"
);

export default function FeaturesPage() {
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
  const [features, setFeatures, featuresLoading] =
    useCachedProjectList<Feature>({
      listType: "features",
      selectedProjectId,
      authenticated: isAuthenticated(),
      fetchList: useCallback(
        (projectId: string) => fetchFeatures(projectId),
        []
      ),
      legacyMigration: {
        load: () => featuresLegacyStorage.load(),
        create: createFeature,
        clear: () => featuresLegacyStorage.clear(),
      },
    });
  const [newFeature, setNewFeature] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const { pushHistory, undo, canUndo } = useUndoList(
    features,
    (items) => setFeatures(items),
    20,
    selectedProjectId ?? undefined
  );

  const isTempId = (id: string) => id.startsWith("temp-");

  const addFeature = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFeature.trim();
    if (!trimmed || !selectedProjectId) return;
    pushHistory();
    const firstDoneIndex = features.findIndex((f) => f.done);
    const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Feature = {
      id: optimisticId,
      name: trimmed,
      done: false,
      order: firstDoneIndex === -1 ? features.length : firstDoneIndex,
      projectId: selectedProjectId,
      createdAt: new Date().toISOString(),
    };
    const inserted =
      firstDoneIndex === -1
        ? [...features, optimistic]
        : [
            ...features.slice(0, firstDoneIndex),
            optimistic,
            ...features.slice(firstDoneIndex),
          ];
    setFeatures(inserted);
    setNewFeature("");
    createFeature({
      projectId: selectedProjectId,
      name: trimmed,
      done: false,
    })
      .then((created) => {
        setFeatures((prev) => {
          const idx = prev.findIndex((f) => f.id === optimisticId);
          if (idx === -1) return [...prev, created];
          const next = [...prev];
          next[idx] = created;
          return next;
        });
        if (firstDoneIndex >= 0) {
          const withCreated = inserted.map((f) =>
            f.id === optimisticId ? created : f
          );
          reorderFeatures(
            selectedProjectId,
            withCreated.map((f) => f.id)
          )
            .then(setFeatures)
            .catch(() => fetchFeatures(selectedProjectId).then(setFeatures));
        }
      })
      .catch(() => {
        setFeatures((prev) => prev.filter((f) => f.id !== optimisticId));
      });
  };

  const toggleDone = async (index: number) => {
    const item = features[index];
    if (isTempId(item.id)) return;
    pushHistory();
    const newDone = !item.done;
    try {
      await updateFeature(item.id, { done: newDone });
      let newIndex = 0;
      setFeatures((prev) => {
        const [reordered, idx] = applyToggleDoneOrder(prev, index, newDone);
        newIndex = idx;
        return reordered;
      });
      if (editingIndex === index) setEditingIndex(newIndex);
    } catch {
      setFeatures((prev) => [...prev]);
    }
  };

  const removeFeature = (index: number, skipHistory?: boolean) => {
    const item = features[index];
    if (isTempId(item.id)) return;
    if (!skipHistory) pushHistory();
    const removed = { ...item };
    setFeatures((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index)
      setEditingIndex(editingIndex - 1);
    deleteFeature(item.id).catch(() => {
      setFeatures((prev) => [
        ...prev.slice(0, index),
        removed,
        ...prev.slice(index),
      ]);
    });
  };

  const startEdit = (index: number) => {
    if (isTempId(features[index]?.id ?? "")) return;
    setEditingIndex(index);
    setEditingValue(features[index]?.name ?? "");
  };

  const saveEdit = async () => {
    if (editingIndex === null) return;
    const item = features[editingIndex];
    if (isTempId(item.id)) return;
    pushHistory();
    const trimmed = editingValue.trim();
    if (trimmed) {
      try {
        await updateFeature(item.id, { name: trimmed });
        setFeatures((prev) => {
          const next = [...prev];
          next[editingIndex] = { ...next[editingIndex], name: trimmed };
          return next;
        });
      } catch {
        // keep previous name
      }
    } else {
      removeFeature(editingIndex, true);
    }
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    pushHistory();
    const reordered = reorder(features, fromIndex, toIndex);
    setFeatures(reordered);
    if (editingIndex !== null) {
      let newEditIndex = editingIndex;
      if (fromIndex === editingIndex) newEditIndex = toIndex;
      else if (fromIndex < editingIndex && toIndex >= editingIndex)
        newEditIndex = editingIndex - 1;
      else if (fromIndex > editingIndex && toIndex <= editingIndex)
        newEditIndex = editingIndex + 1;
      setEditingIndex(newEditIndex);
    }
    reorderFeatures(
      selectedProjectId,
      reordered.map((f) => f.id)
    )
      .then(setFeatures)
      .catch(() => setFeatures(features));
  };

  return (
    <AppLayout
      title="Features · Idea Home"
      activeTab="list"
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
        <h1 className="tests-page-title">Features</h1>

        <section className="tests-page-section">
          <ProjectSectionGuard
            projectsLoaded={projectsLoaded}
            selectedProjectId={selectedProjectId}
            message="Select a project to add features."
            variant="add"
          >
            <AddItemForm
              value={newFeature}
              onChange={setNewFeature}
              onSubmit={addFeature}
              placeholder="Feature name or description"
              ariaLabel="New feature"
              submitAriaLabel="Add feature"
              submitTitle="Add feature"
            />
          </ProjectSectionGuard>
        </section>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">
            Feature List{" "}
            <span className="tests-page-section-count" aria-label="Count">
              {features.length}
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
            message="Select a project to see and manage features."
            variant="list"
          >
            <CheckableList
              items={features}
              itemLabel="feature"
              emptyMessage="No features yet. Add one above."
              loading={featuresLoading}
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
