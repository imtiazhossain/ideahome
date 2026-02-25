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
import { useCheckableProjectList } from "../lib/useCheckableProjectList";
import { useProjectLayout } from "../lib/useProjectLayout";
import { CheckableListPage } from "../components/CheckableListPage";
import { useTheme } from "./_app";

const todoLegacyStorage = createLegacyListStorage(
  "ideahome-todo-list",
  "ideahome-todo-list"
);

export default function TodoPage() {
  const layout = useProjectLayout();
  const theme = useTheme();
  const [addError, setAddError] = useState<string | null>(null);
  const list = useCheckableProjectList<Todo>({
    listType: "todos",
    selectedProjectId: layout.selectedProjectId,
    authenticated: isAuthenticated(),
    fetchList: useCallback((projectId: string) => fetchTodos(projectId), []),
    createItem: createTodo,
    updateItem: updateTodo,
    deleteItem: deleteTodo,
    reorderItems: reorderTodos,
    legacyMigration: {
      load: () => todoLegacyStorage.load(),
      create: createTodo,
      clear: () => todoLegacyStorage.clear(),
    },
    onAddError: (err) =>
      setAddError(err.message || "Failed to add item. Try again."),
    onReorderError: () =>
      setAddError("Order could not be saved. Item was added."),
  });

  const handleAddTodo = (e: React.FormEvent) => {
    setAddError(null);
    list.addItem(e);
  };

  return (
    <CheckableListPage
      config={{
        title: "To-Do · Idea Home",
        activeTab: "todo",
        pageTitle: "To-Do",
        itemLabel: "to-do",
        listTitle: "To-Do List",
        emptyMessage: "No items yet. Add one above.",
        addPlaceholder: "To-do item",
        addGuardMessage: "Select a project to add to-dos.",
        listGuardMessage: "Select a project to see and manage to-dos.",
        list,
        layout,
        theme,
        addFormProps: {
          error: addError,
          onClearError: () => setAddError(null),
        },
        onAddSubmit: handleAddTodo,
      }}
    />
  );
}
