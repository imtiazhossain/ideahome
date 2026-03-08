import React from "react";
import { AppLayout } from "./AppLayout";
import { AddItemForm } from "./AddItemForm";
import { ProjectSectionGuard } from "./ProjectSectionGuard";
import { CheckableList } from "./CheckableList";
import { IconUndo } from "./IconUndo";
import { IconTrash } from "./IconTrash";
import { IconCopy } from "./icons";
import { IconBrokenBulb } from "./icons/IconBrokenBulb";
import { SectionLoadingSpinner } from "./SectionLoadingSpinner";
import { ErrorBanner } from "./ErrorBanner";
import { UiMenuDropdown } from "./UiMenuDropdown";
import type { CheckableSortMode } from "../lib/utils";

export interface CheckableListPageShellProps {
  appLayoutProps: Omit<React.ComponentProps<typeof AppLayout>, "children">;
  pageTitle: string;
  addFormProps: React.ComponentProps<typeof AddItemForm>;
  listTitle: string;
  itemCount: number;
  canUndo: boolean;
  onUndo: () => void;
  onCopyList?: () => void;
  onSort?: (mode: CheckableSortMode) => void;
  currentSortMode?: CheckableSortMode | null;
  sortDisabled?: boolean;
  copyListAriaLabel?: string;
  copyListTitle?: string;
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
  errorMessage?: string | null;
  toastMessage?: string | null;
}

export function CheckableListPageShell({
  appLayoutProps,
  pageTitle: _pageTitle,
  addFormProps,
  listTitle: _listTitle,
  itemCount,
  canUndo,
  onUndo,
  onCopyList,
  onSort,
  currentSortMode = null,
  sortDisabled = false,
  copyListAriaLabel = "Copy list",
  copyListTitle = "Copy list as bullet points",
  canBulkDelete = false,
  onBulkDelete,
  checkableListProps,
  addGuard,
  listGuard,
  errorMessage = null,
  toastMessage = null,
}: CheckableListPageShellProps) {
  const sortDropdownRef = React.useRef<HTMLDivElement>(null);
  const [sortDropdownOpen, setSortDropdownOpen] = React.useState(false);

  React.useEffect(() => {
    if (!sortDropdownOpen) return;
    const onOutside = (event: MouseEvent) => {
      if (!sortDropdownRef.current) return;
      if (!sortDropdownRef.current.contains(event.target as Node)) {
        setSortDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [sortDropdownOpen]);

  const isPageLoading =
    Boolean(checkableListProps.loading) ||
    (addGuard ? !addGuard.projectsLoaded : false) ||
    (listGuard ? !listGuard.projectsLoaded : false);
  const isBackendOfflineError =
    Boolean(errorMessage) &&
    /api is offline|failed to fetch|networkerror|load failed|connection refused|err_connection_refused/i.test(
      errorMessage ?? ""
    );
  const addContent = <AddItemForm {...addFormProps} />;

  const listContent = <CheckableList {...checkableListProps} />;
  const hasListItems = itemCount > 0;

  return (
    <AppLayout {...appLayoutProps}>
      <div className="tests-page-content">
        {isBackendOfflineError ? (
          <section className="tests-page-offline-state" role="status" aria-live="polite">
            <IconBrokenBulb className="tests-page-offline-state-icon" />
            <p className="tests-page-offline-state-title">
              Looks like the lights went out, we&apos;re going to turn them on
              right away.
            </p>
          </section>
        ) : isPageLoading ? (
          <div className="tests-page-single-loading">
            <SectionLoadingSpinner />
          </div>
        ) : (
          <>
            {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
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
              {hasListItems && (onCopyList || onSort || canUndo || canBulkDelete) && (
                <div className="tests-page-section-footer">
                  <div className="tests-page-section-footer-right">
                    {onCopyList ? (
                      <button
                        type="button"
                        className="tests-page-section-copy-icon"
                        onClick={onCopyList}
                        aria-label={copyListAriaLabel}
                        title={copyListTitle}
                      >
                        <IconCopy />
                      </button>
                    ) : null}
                    {onSort ? (
                      <UiMenuDropdown
                        ref={sortDropdownRef}
                        open={sortDropdownOpen}
                        onOpenChange={setSortDropdownOpen}
                        triggerAriaLabel="Sort list"
                        triggerText="Sort"
                        className="tests-page-section-sort-dropdown"
                        triggerClassName="tests-page-section-sort-trigger"
                        menuClassName="tests-page-section-sort-menu"
                        disabled={sortDisabled}
                        groups={[
                          {
                            id: "sort-options",
                            items: [
                              {
                                id: "sort-name-asc",
                                label: `${currentSortMode === "name-asc" ? "✓ " : ""}A to Z`,
                                selected: currentSortMode === "name-asc",
                                onSelect: () => onSort("name-asc"),
                              },
                              {
                                id: "sort-name-desc",
                                label: `${currentSortMode === "name-desc" ? "✓ " : ""}Z to A`,
                                selected: currentSortMode === "name-desc",
                                onSelect: () => onSort("name-desc"),
                              },
                              {
                                id: "sort-created-desc",
                                label: `${currentSortMode === "created-desc" ? "✓ " : ""}Newest first`,
                                selected: currentSortMode === "created-desc",
                                onSelect: () => onSort("created-desc"),
                              },
                              {
                                id: "sort-created-asc",
                                label: `${currentSortMode === "created-asc" ? "✓ " : ""}Oldest first`,
                                selected: currentSortMode === "created-asc",
                                onSelect: () => onSort("created-asc"),
                              },
                            ],
                          },
                        ]}
                      />
                    ) : null}
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
                        title="Delete All Completed Items"
                      >
                        <IconTrash />
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
      {toastMessage ? (
        <div className="checkable-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}
    </AppLayout>
  );
}
