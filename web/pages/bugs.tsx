import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  createBug,
  deleteBug,
  fetchBugs,
  fetchProjects,
  isAuthenticated,
  reorderBugs,
  updateProject,
  updateBug,
  type Bug,
} from "../lib/api";
import { createLegacyListStorage } from "../lib/legacyListStorage";
import { reorder } from "../lib/utils";
import { CheckableList } from "../components/CheckableList";
import { AppLayout } from "../components/AppLayout";
import { AddItemForm } from "../components/AddItemForm";
import { useTheme } from "./_app";

const bugsLegacyStorage = createLegacyListStorage(
  "ideahome-bugs-list",
  "ideahome-bugs-list"
);

export default function BugsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [newBug, setNewBug] = useState("");
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
      setBugs([]);
      return;
    }
    let cancelled = false;
    setBugsLoading(true);
    fetchBugs(selectedProjectId)
      .then((data) => {
        if (cancelled) return;
        setBugs(data);
        if (
          !migratedFromStorageRef.current &&
          data.length === 0 &&
          bugsLegacyStorage.load().length > 0
        ) {
          migratedFromStorageRef.current = true;
          const legacy = bugsLegacyStorage.load();
          Promise.all(
            legacy.map((item) =>
              createBug({
                projectId: selectedProjectId,
                name: item.name,
                done: item.done,
              })
            )
          )
            .then((created) => {
              if (cancelled) return;
              setBugs(created);
              bugsLegacyStorage.clear();
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setBugs([]);
      })
      .finally(() => {
        if (!cancelled) setBugsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const isTempId = (id: string) => id.startsWith("temp-");

  const addBug = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBug.trim();
    if (!trimmed || !selectedProjectId) return;
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
          reorderBugs(selectedProjectId, withCreated.map((b) => b.id))
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

  const removeBug = (index: number) => {
    const item = bugs[index];
    if (isTempId(item.id)) return;
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
      removeBug(editingIndex);
    }
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
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
    reorderBugs(selectedProjectId, reordered.map((b) => b.id))
      .then(setBugs)
      .catch(() => setBugs(bugs));
  };

  return (
    <AppLayout
      title="Bugs · Idea Home"
      activeTab="forms"
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
        <h1 className="tests-page-title">Bugs</h1>

        <section className="tests-page-section">
          {selectedProjectId ? (
            <AddItemForm
              value={newBug}
              onChange={setNewBug}
              onSubmit={addBug}
              placeholder="Bug name or description"
              ariaLabel="New bug"
              submitAriaLabel="Add bug"
              submitTitle="Add bug"
            />
          ) : (
            <p className="tests-page-section-desc">
              Select a project to add bugs.
            </p>
          )}
        </section>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">
            Bug List{" "}
            <span className="tests-page-section-count" aria-label="Count">
              {bugs.length}
            </span>
          </h2>
          {!selectedProjectId ? (
            <p className="tests-page-section-desc">
              Select a project to see and manage bugs.
            </p>
          ) : (
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
              onRemove={removeBug}
              onReorder={handleReorder}
            />
          )}
        </section>
      </div>
    </AppLayout>
  );
}
