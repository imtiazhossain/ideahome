import React from "react";
import type { ProjectNavTabId } from "./ProjectNavBar";
import { CheckableList } from "./CheckableList";
import { AppLayout } from "./AppLayout";
import { AddItemForm } from "./AddItemForm";
import { ProjectSectionGuard } from "./ProjectSectionGuard";
import { IconUndo } from "./IconUndo";
import { isOptimisticId } from "../lib/utils";

export interface CheckableListPageConfig<T> {
  title: string;
  activeTab: ProjectNavTabId;
  pageTitle: string;
  itemLabel: string;
  listTitle: string;
  emptyMessage: string;
  addPlaceholder: string;
  addGuardMessage: string;
  listGuardMessage: string;
  list: {
    items: T[];
    loading: boolean;
    newItem: string;
    setNewItem: (v: string) => void;
    editingIndex: number | null;
    editingValue: string;
    setEditingValue: (v: string) => void;
    addItem: (e: React.FormEvent) => void;
    toggleDone: (index: number) => Promise<void>;
    removeItem: (index: number, skipHistory?: boolean) => void;
    startEdit: (index: number) => void;
    saveEdit: () => Promise<void>;
    cancelEdit: () => void;
    handleReorder: (from: number, to: number) => void;
    undo: () => void;
    canUndo: boolean;
  };
  layout: {
    projects: { id: string; name: string }[];
    projectsLoaded: boolean;
    selectedProjectId: string | null;
    setSelectedProjectId: (id: string) => void;
    projectDisplayName: string;
    drawerOpen: boolean;
    setDrawerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    editingProjectId: string | null;
    setEditingProjectId: (id: string | null) => void;
    editingProjectName: string;
    setEditingProjectName: (name: string) => void;
    projectNameInputRef: React.RefObject<HTMLInputElement | null>;
    saveProjectName: () => void;
    cancelEditProjectName: () => void;
    projectToDelete: { id: string; name: string } | null;
    setProjectToDelete: (p: { id: string; name: string } | null) => void;
    projectDeleting: boolean;
    handleDeleteProject: () => Promise<void>;
  };
  theme: { theme: string; toggleTheme: () => void };
  addFormProps?: {
    error?: string | null;
    onClearError?: () => void;
  };
  onAddSubmit?: (e: React.FormEvent) => void;
}

export function CheckableListPage<T extends { id: string; name: string; done: boolean }>({
  config,
}: {
  config: CheckableListPageConfig<T>;
}) {
  const {
    title,
    activeTab,
    pageTitle,
    itemLabel,
    listTitle,
    emptyMessage,
    addPlaceholder,
    addGuardMessage,
    listGuardMessage,
    list,
    layout,
    theme,
    addFormProps,
    onAddSubmit,
  } = config;

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

  const { theme: themeValue, toggleTheme } = theme;

  return (
    <AppLayout
      title={title}
      activeTab={activeTab}
      projectName={projectDisplayName}
      projectId={selectedProjectId || undefined}
      searchPlaceholder="Search project"
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      projects={projects}
      selectedProjectId={selectedProjectId ?? ""}
      setSelectedProjectId={setSelectedProjectId}
      editingProjectId={editingProjectId}
      setEditingProjectId={setEditingProjectId}
      editingProjectName={editingProjectName}
      setEditingProjectName={setEditingProjectName}
      saveProjectName={saveProjectName}
      cancelEditProjectName={cancelEditProjectName}
      projectNameInputRef={projectNameInputRef}
      theme={themeValue}
      toggleTheme={toggleTheme}
      projectToDelete={projectToDelete}
      setProjectToDelete={setProjectToDelete}
      projectDeleting={projectDeleting}
      handleDeleteProject={handleDeleteProject}
    >
      <div className="tests-page-content">
        <h1 className="tests-page-title">{pageTitle}</h1>

        <section className="tests-page-section">
          <ProjectSectionGuard
            projectsLoaded={projectsLoaded}
            selectedProjectId={selectedProjectId ?? ""}
            message={addGuardMessage}
            variant="add"
          >
            <AddItemForm
              value={list.newItem}
              onChange={list.setNewItem}
              onSubmit={onAddSubmit ?? list.addItem}
              placeholder={addPlaceholder}
              ariaLabel={`New ${itemLabel}`}
              submitAriaLabel={`Add ${itemLabel}`}
              submitTitle={`Add ${itemLabel}`}
              {...addFormProps}
            />
          </ProjectSectionGuard>
        </section>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">
            {listTitle}{" "}
            <span className="tests-page-section-count" aria-label="Count">
              {list.items.length}
            </span>
            {list.canUndo && (
              <button
                type="button"
                className="tests-page-section-undo"
                onClick={list.undo}
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
            selectedProjectId={selectedProjectId ?? ""}
            message={listGuardMessage}
            variant="list"
          >
            <CheckableList
              items={list.items}
              itemLabel={itemLabel}
              emptyMessage={emptyMessage}
              loading={list.loading}
              isItemDisabled={(item) => isOptimisticId(item.id)}
              editingIndex={list.editingIndex}
              editingValue={list.editingValue}
              onEditingValueChange={list.setEditingValue}
              onStartEdit={list.startEdit}
              onSaveEdit={list.saveEdit}
              onCancelEdit={list.cancelEdit}
              onToggleDone={list.toggleDone}
              onReorder={list.handleReorder}
              onDelete={list.removeItem}
            />
          </ProjectSectionGuard>
        </section>
      </div>
    </AppLayout>
  );
}
