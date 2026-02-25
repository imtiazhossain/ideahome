import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  createIdea,
  deleteIdea,
  fetchIdeas,
  fetchProjects,
  isAuthenticated,
  reorderIdeas,
  updateProject,
  updateIdea,
  type Idea,
} from "../lib/api";
import { createLegacyListStorage } from "../lib/legacyListStorage";
import { reorder } from "../lib/utils";
import { CheckableList } from "../components/CheckableList";
import { AppLayout } from "../components/AppLayout";
import { AddItemForm } from "../components/AddItemForm";
import { useTheme } from "./_app";

const ideasLegacyStorage = createLegacyListStorage(
  "ideahome-ideas-list",
  "ideahome-ideas-list"
);

export default function IdeasPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [newIdea, setNewIdea] = useState("");
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
      setIdeas([]);
      return;
    }
    let cancelled = false;
    setIdeasLoading(true);
    fetchIdeas(selectedProjectId)
      .then((data) => {
        if (cancelled) return;
        setIdeas(data);
        if (
          !migratedFromStorageRef.current &&
          data.length === 0 &&
          ideasLegacyStorage.load().length > 0
        ) {
          migratedFromStorageRef.current = true;
          const legacy = ideasLegacyStorage.load();
          Promise.all(
            legacy.map((item) =>
              createIdea({
                projectId: selectedProjectId,
                name: item.name,
                done: item.done,
              })
            )
          )
            .then((created) => {
              if (cancelled) return;
              setIdeas(created);
              ideasLegacyStorage.clear();
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setIdeas([]);
      })
      .finally(() => {
        if (!cancelled) setIdeasLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const isTempId = (id: string) => id.startsWith("temp-");

  const addIdea = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newIdea.trim();
    if (!trimmed || !selectedProjectId) return;
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
          reorderIdeas(selectedProjectId, withCreated.map((i) => i.id))
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

  const removeIdea = (index: number) => {
    const item = ideas[index];
    if (isTempId(item.id)) return;
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
      removeIdea(editingIndex);
    }
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
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
    reorderIdeas(selectedProjectId, reordered.map((i) => i.id))
      .then(setIdeas)
      .catch(() => setIdeas(ideas));
  };

  return (
    <AppLayout
      title="Ideas · Idea Home"
      activeTab="ideas"
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
        <h1 className="tests-page-title">Ideas</h1>

        <section className="tests-page-section">
          {selectedProjectId ? (
            <AddItemForm
              value={newIdea}
              onChange={setNewIdea}
              onSubmit={addIdea}
              placeholder="Idea item"
              ariaLabel="New idea"
              submitAriaLabel="Add idea"
              submitTitle="Add idea"
            />
          ) : (
            <p className="tests-page-section-desc">
              Select a project to add ideas.
            </p>
          )}
        </section>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">
            Ideas List{" "}
            <span className="tests-page-section-count" aria-label="Count">
              {ideas.length}
            </span>
          </h2>
          {!selectedProjectId ? (
            <p className="tests-page-section-desc">
              Select a project to see and manage ideas.
            </p>
          ) : (
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
              onRemove={removeIdea}
              onReorder={handleReorder}
            />
          )}
        </section>
      </div>
    </AppLayout>
  );
}
