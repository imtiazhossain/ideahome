import React from "react";
import { AppLayout } from "./AppLayout";
import { AddItemForm } from "./AddItemForm";
import { ProjectSectionGuard } from "./ProjectSectionGuard";
import { CheckableList } from "./CheckableList";
import { IconUndo } from "./IconUndo";

export interface CheckableListPageShellProps {
  appLayoutProps: Omit<React.ComponentProps<typeof AppLayout>, "children">;
  pageTitle: string;
  addFormProps: React.ComponentProps<typeof AddItemForm>;
  listTitle: string;
  itemCount: number;
  canUndo: boolean;
  onUndo: () => void;
  checkableListProps: React.ComponentProps<typeof CheckableList>;
  addGuard?: { projectsLoaded: boolean; selectedProjectId: string; message: string };
  listGuard?: { projectsLoaded: boolean; selectedProjectId: string; message: string };
}

export function CheckableListPageShell({
  appLayoutProps,
  pageTitle,
  addFormProps,
  listTitle,
  itemCount,
  canUndo,
  onUndo,
  checkableListProps,
  addGuard,
  listGuard,
}: CheckableListPageShellProps) {
  const addContent = (
    <AddItemForm {...addFormProps} />
  );

  const listContent = (
    <CheckableList {...checkableListProps} />
  );

  return (
    <AppLayout {...appLayoutProps}>
      <div className="tests-page-content">
        <h1 className="tests-page-title">{pageTitle}</h1>

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
          <h2 className="tests-page-section-title">
            {listTitle}{" "}
            <span className="tests-page-section-count" aria-label="Count">
              {itemCount}
            </span>
            {canUndo && (
              <button
                type="button"
                className="tests-page-section-undo"
                onClick={onUndo}
                aria-label="Undo last change"
                title="Undo"
              >
                <IconUndo />
                Undo
              </button>
            )}
          </h2>
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
        </section>
      </div>
    </AppLayout>
  );
}
