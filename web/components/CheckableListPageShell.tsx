import React from "react";
import { AppLayout } from "./AppLayout";
import { AddItemForm } from "./AddItemForm";
import { ProjectSectionGuard } from "./ProjectSectionGuard";
import { CheckableList } from "./CheckableList";
import { IconUndo } from "./IconUndo";
import { IconTrash } from "./IconTrash";

export interface CheckableListPageShellProps {
  appLayoutProps: Omit<React.ComponentProps<typeof AppLayout>, "children">;
  pageTitle: string;
  addFormProps: React.ComponentProps<typeof AddItemForm>;
  listTitle: string;
  itemCount: number;
  canUndo: boolean;
  onUndo: () => void;
  canBulkDelete?: boolean;
  onBulkDelete?: () => void;
  checkableListProps: React.ComponentProps<typeof CheckableList>;
  addGuard?: {
    projectsLoaded: boolean;
    selectedProjectId: string;
    message: string;
  };
  listGuard?: {
    projectsLoaded: boolean;
    selectedProjectId: string;
    message: string;
  };
  toastMessage?: string | null;
}

export function CheckableListPageShell({
  appLayoutProps,
  pageTitle: _pageTitle,
  addFormProps,
  listTitle: _listTitle,
  itemCount: _itemCount,
  canUndo,
  onUndo,
  canBulkDelete = false,
  onBulkDelete,
  checkableListProps,
  addGuard,
  listGuard,
  toastMessage = null,
}: CheckableListPageShellProps) {
  const addContent = <AddItemForm {...addFormProps} />;

  const listContent = <CheckableList {...checkableListProps} />;

  return (
    <AppLayout {...appLayoutProps}>
      <div className="tests-page-content">
        <section className="tests-page-section">
          {addGuard ? (
            <ProjectSectionGuard
              projectsLoaded={addGuard.projectsLoaded}
              selectedProjectId={addGuard.selectedProjectId}
              message={addGuard.message}
              variant="add"
            >
              {addContent}
            </ProjectSectionGuard>
          ) : (
            addContent
          )}
        </section>

        <section className="tests-page-section">
          {listGuard ? (
            <ProjectSectionGuard
              projectsLoaded={listGuard.projectsLoaded}
              selectedProjectId={listGuard.selectedProjectId}
              message={listGuard.message}
              variant="list"
            >
              {listContent}
            </ProjectSectionGuard>
          ) : (
            listContent
          )}
          {(canUndo || canBulkDelete) && (
            <div className="tests-page-section-footer">
              {canUndo ? (
                <button
                  type="button"
                  className="tests-page-section-undo"
                  onClick={onUndo}
                  aria-label="Undo last change"
                  title="Undo"
                >
                  <IconUndo />
                </button>
              ) : null}
              {canBulkDelete && onBulkDelete ? (
                <button
                  type="button"
                  className="tests-page-section-bulk-delete"
                  onClick={onBulkDelete}
                  aria-label="Delete all completed items"
                  title="Delete all completed items"
                >
                  <IconTrash />
                </button>
              ) : null}
            </div>
          )}
        </section>
      </div>
      {toastMessage ? (
        <div className="checkable-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}
    </AppLayout>
  );
}
