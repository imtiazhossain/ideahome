import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  createFeature,
  deleteFeature,
  fetchFeatures,
  fetchProjects,
  isAuthenticated,
  reorderFeatures,
  updateProject,
  updateFeature,
  type Feature,
} from "../lib/api";
import { createLegacyListStorage } from "../lib/legacyListStorage";
import { reorder } from "../lib/utils";
import { CheckableList } from "../components/CheckableList";
import { AppLayout } from "../components/AppLayout";
import { AddItemForm } from "../components/AddItemForm";
import { useTheme } from "./_app";

const featuresLegacyStorage = createLegacyListStorage(
  "ideahome-features-list",
  "ideahome-features-list"
);

export default function FeaturesPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [newFeature, setNewFeature] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const migratedFromStorageRef = useRef(false);

  const loadProjects = () =>
    fetchProjects()
      .then((data) => {
        setProjects(data);
        if (data.length && !selectedProjectId) setSelectedProjectId(data[0].id);
      })
      .catch(() => {});

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    loadProjects();
  }, [router]);
  useEffect(() => {
    if (editingProjectId) {
      projectNameInputRef.current?.focus();
      projectNameInputRef.current?.select();
    }
  }, [editingProjectId]);

  const saveProjectName = async () => {
    if (!editingProjectId) return;
    const name = editingProjectName.trim();
    if (!name) {
      setEditingProjectId(null);
      return;
    }
    const prev = projects.find((x) => x.id === editingProjectId);
    if (prev?.name === name) {
      setEditingProjectId(null);
      return;
    }
    try {
      const updated = await updateProject(editingProjectId, { name });
      setProjects((p) =>
        p.map((x) => (x.id === editingProjectId ? updated : x))
      );
    } catch {
      // Keep edit mode on error
    } finally {
      setEditingProjectId(null);
    }
  };

  const cancelEditProjectName = () => {
    setEditingProjectId(null);
  };

  useEffect(() => {
    if (!isAuthenticated() || !selectedProjectId) {
      setFeatures([]);
      return;
    }
    let cancelled = false;
    setFeaturesLoading(true);
    fetchFeatures(selectedProjectId)
      .then((data) => {
        if (cancelled) return;
        setFeatures(data);
        if (
          !migratedFromStorageRef.current &&
          data.length === 0 &&
          featuresLegacyStorage.load().length > 0
        ) {
          migratedFromStorageRef.current = true;
          const legacy = featuresLegacyStorage.load();
          Promise.all(
            legacy.map((item) =>
              createFeature({
                projectId: selectedProjectId,
                name: item.name,
                done: item.done,
              })
            )
          )
            .then((created) => {
              if (cancelled) return;
              setFeatures(created);
              featuresLegacyStorage.clear();
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setFeatures([]);
      })
      .finally(() => {
        if (!cancelled) setFeaturesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const isTempId = (id: string) => id.startsWith("temp-");

  const addFeature = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFeature.trim();
    if (!trimmed || !selectedProjectId) return;
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
          reorderFeatures(selectedProjectId, withCreated.map((f) => f.id))
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
    const newDone = !item.done;
    try {
      await updateFeature(item.id, { done: newDone });
      setFeatures((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], done: newDone };
        const without = next.filter((_, i) => i !== index);
        return newDone ? [...without, next[index]] : [next[index], ...without];
      });
      if (editingIndex === index) {
        setEditingIndex(newDone ? features.length - 1 : 0);
      }
    } catch {
      setFeatures((prev) => [...prev]);
    }
  };

  const removeFeature = (index: number) => {
    const item = features[index];
    if (isTempId(item.id)) return;
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
      removeFeature(editingIndex);
    }
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
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
    reorderFeatures(selectedProjectId, reordered.map((f) => f.id))
      .then(setFeatures)
      .catch(() => setFeatures(features));
  };

  return (
    <AppLayout
      title="Features · Idea Home"
      activeTab="list"
      projectName={
        projects.find((p) => p.id === selectedProjectId)?.name ??
        (selectedProjectId ? "Project" : "Select a project")
      }
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
        <h1 className="tests-page-title">Features</h1>

        <section className="tests-page-section">
          {selectedProjectId ? (
            <AddItemForm
              value={newFeature}
              onChange={setNewFeature}
              onSubmit={addFeature}
              placeholder="Feature name or description"
              ariaLabel="New feature"
              submitAriaLabel="Add feature"
              submitTitle="Add feature"
            />
          ) : (
            <p className="tests-page-section-desc">
              Select a project to add features.
            </p>
          )}
        </section>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">
            Feature List{" "}
            <span className="tests-page-section-count" aria-label="Count">
              {features.length}
            </span>
          </h2>
          {!selectedProjectId ? (
            <p className="tests-page-section-desc">
              Select a project to see and manage features.
            </p>
          ) : (
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
              onRemove={removeFeature}
              onReorder={handleReorder}
            />
          )}
        </section>
      </div>
    </AppLayout>
  );
}
