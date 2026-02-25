import React, { useCallback, useState } from "react";
import {
  createTodo,
  deleteTodo,
  fetchTodos,
  isAuthenticated,
  reorderTodos,
  updateTodo,
  type Todo,
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

const todoLegacyStorage = createLegacyListStorage(
  "ideahome-todo-list",
  "ideahome-todo-list"
);

export default function TodoPage() {
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
  const [todos, setTodos, todosLoading] = useCachedProjectList<Todo>({
    listType: "todos",
    selectedProjectId,
    authenticated: isAuthenticated(),
    fetchList: useCallback((projectId: string) => fetchTodos(projectId), []),
    legacyMigration: {
      load: () => todoLegacyStorage.load(),
      create: createTodo,
      clear: () => todoLegacyStorage.clear(),
    },
  });
  const [newTodo, setNewTodo] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const { pushHistory, undo, canUndo } = useUndoList(
    todos,
    (items) => setTodos(items),
    20,
    selectedProjectId ?? undefined
  );

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const trimmed = newTodo.trim();
    if (!trimmed || !selectedProjectId) return;
    pushHistory();
    const firstDoneIndex = todos.findIndex((t) => t.done);
    const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Todo = {
      id: optimisticId,
      name: trimmed,
      done: false,
      order: firstDoneIndex === -1 ? todos.length : firstDoneIndex,
      projectId: selectedProjectId,
      createdAt: new Date().toISOString(),
    };
    const inserted =
      firstDoneIndex === -1
        ? [...todos, optimistic]
        : [
            ...todos.slice(0, firstDoneIndex),
            optimistic,
            ...todos.slice(firstDoneIndex),
          ];
    setTodos(inserted);
    setNewTodo("");
    createTodo({
      projectId: selectedProjectId,
      name: trimmed,
      done: false,
    })
      .then((created) => {
        setTodos((prev) => {
          const idx = prev.findIndex((t) => t.id === optimisticId);
          if (idx === -1) return [...prev, created];
          const next = [...prev];
          next[idx] = created;
          return next;
        });
        if (firstDoneIndex >= 0) {
          const withCreated = inserted.map((t) =>
            t.id === optimisticId ? created : t
          );
          reorderTodos(
            selectedProjectId,
            withCreated.map((t) => t.id)
          )
            .then(setTodos)
            .catch(() => {
              fetchTodos(selectedProjectId).then(setTodos);
              setAddError("Order could not be saved. Item was added.");
            });
        }
      })
      .catch((err) => {
        setTodos((prev) => prev.filter((t) => t.id !== optimisticId));
        setAddError(
          err instanceof Error ? err.message : "Failed to add item. Try again."
        );
      });
  };

  const isTempId = (id: string) => id.startsWith("temp-");

  const toggleDone = async (index: number) => {
    const item = todos[index];
    if (isTempId(item.id)) return;
    pushHistory();
    const newDone = !item.done;
    try {
      await updateTodo(item.id, { done: newDone });
      setTodos((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], done: newDone };
        const without = next.filter((_, i) => i !== index);
        return newDone ? [...without, next[index]] : [next[index], ...without];
      });
      if (editingIndex === index) {
        setEditingIndex(newDone ? todos.length - 1 : 0);
      }
    } catch {
      setTodos((prev) => [...prev]);
    }
  };

  const removeTodo = (index: number, skipHistory?: boolean) => {
    const item = todos[index];
    if (isTempId(item.id)) return;
    if (!skipHistory) pushHistory();
    const removed = { ...item };
    setTodos((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index)
      setEditingIndex(editingIndex - 1);
    deleteTodo(item.id).catch(() => {
      setTodos((prev) => [
        ...prev.slice(0, index),
        removed,
        ...prev.slice(index),
      ]);
    });
  };

  const startEdit = (index: number) => {
    if (isTempId(todos[index]?.id ?? "")) return;
    setEditingIndex(index);
    setEditingValue(todos[index]?.name ?? "");
  };

  const saveEdit = async () => {
    if (editingIndex === null) return;
    const item = todos[editingIndex];
    if (isTempId(item.id)) return;
    pushHistory();
    const trimmed = editingValue.trim();
    if (trimmed) {
      try {
        await updateTodo(item.id, { name: trimmed });
        setTodos((prev) => {
          const next = [...prev];
          next[editingIndex] = { ...next[editingIndex], name: trimmed };
          return next;
        });
      } catch {
        // keep previous name
      }
    } else {
      removeTodo(editingIndex, true);
    }
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    pushHistory();
    const reordered = reorder(todos, fromIndex, toIndex);
    setTodos(reordered);
    if (editingIndex !== null) {
      let newEditIndex = editingIndex;
      if (fromIndex === editingIndex) newEditIndex = toIndex;
      else if (fromIndex < editingIndex && toIndex >= editingIndex)
        newEditIndex = editingIndex - 1;
      else if (fromIndex > editingIndex && toIndex <= editingIndex)
        newEditIndex = editingIndex + 1;
      setEditingIndex(newEditIndex);
    }
    reorderTodos(
      selectedProjectId,
      reordered.map((t) => t.id)
    )
      .then(setTodos)
      .catch(() => {
        fetchTodos(selectedProjectId).then(setTodos);
        setAddError("Order could not be saved. Item was added.");
      });
  };

  return (
    <AppLayout
      title="To-Do · Idea Home"
      activeTab="todo"
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
        <h1 className="tests-page-title">To-Do</h1>

        <section className="tests-page-section">
          <ProjectSectionGuard
            projectsLoaded={projectsLoaded}
            selectedProjectId={selectedProjectId}
            message="Select a project to add to-dos."
            variant="add"
          >
            <AddItemForm
              value={newTodo}
              onChange={setNewTodo}
              onSubmit={addTodo}
              placeholder="To-do item"
              ariaLabel="New to-do"
              submitAriaLabel="Add to-do"
              submitTitle="Add to-do"
              error={addError}
              onClearError={() => setAddError(null)}
            />
          </ProjectSectionGuard>
        </section>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">
            To-Do List{" "}
            <span className="tests-page-section-count" aria-label="Count">
              {todos.length}
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
            message="Select a project to see and manage to-dos."
            variant="list"
          >
            <CheckableList
              items={todos}
              itemLabel="to-do"
              emptyMessage="No items yet. Add one above."
              loading={todosLoading}
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
