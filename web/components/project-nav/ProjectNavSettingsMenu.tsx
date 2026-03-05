import { IconChevronUp, IconFilter, IconReorder, IconSettings } from "../icons";
import { IconPlus } from "../IconPlus";
import { IconTrash } from "../IconTrash";
import { TABS, type ProjectNavTabId } from "./tab-order";
import { getCustomListTabId } from "../../lib/customLists";
import type { RefObject } from "react";

interface CustomListEntry {
  slug: string;
  name: string;
}

interface ProjectNavSettingsMenuProps {
  showSettingsButton: boolean;
  settingsButtonVisible: boolean;
  settingsMenuOpen: boolean;
  setSettingsMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  settingsMenuRef: RefObject<HTMLDivElement>;
  closeSettingsMenu: () => void;
  onDeleteAllIssuesClick?: () => void;
  deleteAllIssuesDisabled?: boolean;
  reorderSectionOpen: boolean;
  setReorderSectionOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  showTabsSectionOpen: boolean;
  setShowTabsSectionOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  addSectionOpen: boolean;
  setAddSectionOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  deleteProjectSectionOpen: boolean;
  setDeleteProjectSectionOpen: (
    open: boolean | ((prev: boolean) => boolean)
  ) => void;
  tabOrder: ProjectNavTabId[];
  hiddenSet: Set<ProjectNavTabId>;
  hiddenTabIds: ProjectNavTabId[];
  setHiddenTabIds: (ids: ProjectNavTabId[]) => void;
  deletedTabIds: ProjectNavTabId[];
  restoreDeletedTabs: () => void;
  deleteTab: (id: ProjectNavTabId) => void;
  moveTabVisible: (tabId: ProjectNavTabId, direction: "up" | "down") => void;
  isMobile: boolean;
  customLists: CustomListEntry[];
  onAddClick?: () => void;
  onOpenCreateListModal: () => void;
  onOpenAppearanceSettings?: () => void;
  onOpenSettingsRoute: () => void;
  onDeleteProjectClick?: () => void;
  selectedProjectId?: string;
  projectsLength?: number;
}

export function ProjectNavSettingsMenu({
  showSettingsButton,
  settingsButtonVisible,
  settingsMenuOpen,
  setSettingsMenuOpen,
  settingsMenuRef,
  closeSettingsMenu,
  onDeleteAllIssuesClick,
  deleteAllIssuesDisabled,
  reorderSectionOpen,
  setReorderSectionOpen,
  showTabsSectionOpen,
  setShowTabsSectionOpen,
  addSectionOpen,
  setAddSectionOpen,
  deleteProjectSectionOpen,
  setDeleteProjectSectionOpen,
  tabOrder,
  hiddenSet,
  hiddenTabIds,
  setHiddenTabIds,
  deletedTabIds,
  restoreDeletedTabs,
  deleteTab,
  moveTabVisible,
  isMobile,
  customLists,
  onAddClick,
  onOpenCreateListModal,
  onOpenAppearanceSettings,
  onOpenSettingsRoute,
  onDeleteProjectClick,
  selectedProjectId,
  projectsLength,
}: ProjectNavSettingsMenuProps) {
  if (!showSettingsButton) return null;

  return (
    <div ref={settingsMenuRef} className="project-nav-settings-wrap">
      {settingsButtonVisible && settingsMenuOpen && (
        <div
          className="project-nav-settings-menu"
          role="menu"
          aria-label="Settings"
        >
          {onDeleteAllIssuesClick && (
            <button
              type="button"
              role="menuitem"
              className="project-nav-add-menu-item"
              disabled={deleteAllIssuesDisabled}
              onClick={() => {
                closeSettingsMenu();
                onDeleteAllIssuesClick();
              }}
              title={
                deleteAllIssuesDisabled
                  ? "No issues to delete"
                  : "Delete all issues"
              }
              aria-label="Delete all issues"
            >
              Delete all issues
            </button>
          )}
          <button
            type="button"
            className={`project-nav-settings-section-toggle${reorderSectionOpen ? " is-open" : ""}`}
            onClick={() => setReorderSectionOpen((o) => !o)}
            aria-expanded={reorderSectionOpen}
            aria-label="Reorder tabs"
            title="Reorder tabs"
          >
            <IconReorder />
          </button>
          {reorderSectionOpen && (
            <ul className="project-nav-reorder-list" role="list">
              {(() => {
                const visibleTabs = tabOrder
                  .filter((id) => !hiddenSet.has(id))
                  .filter(
                    (id) => !(isMobile && TABS.find((t) => t.id === id)?.desktopOnly)
                  );
                return visibleTabs.map((id, visibleIdx) => {
                  const builtIn = TABS.find((t) => t.id === id);
                  const label =
                    builtIn?.label ??
                    (typeof id === "string" && id.startsWith("custom-")
                      ? (customLists.find((l) => getCustomListTabId(l.slug) === id)
                          ?.name ?? id)
                      : id);
                  return (
                    <li key={id} className="project-nav-reorder-item">
                      <span className="project-nav-reorder-label">{label}</span>
                      <span className="project-nav-reorder-actions">
                        <button
                          type="button"
                          className="project-nav-reorder-btn"
                          onClick={() => moveTabVisible(id, "up")}
                          disabled={visibleIdx === 0}
                          aria-label={`Move ${label} up`}
                          title="Move up"
                        >
                          <IconChevronUp />
                        </button>
                      </span>
                    </li>
                  );
                });
              })()}
            </ul>
          )}
          <button
            type="button"
            className={`project-nav-settings-section-toggle${showTabsSectionOpen ? " is-open" : ""}`}
            onClick={() => setShowTabsSectionOpen((o) => !o)}
            aria-expanded={showTabsSectionOpen}
            aria-label="Filter tabs"
          >
            <IconFilter />
          </button>
          {showTabsSectionOpen && (
            <ul className="project-nav-filter-list" role="list">
              {[...tabOrder]
                .filter(
                  (id) => !(isMobile && TABS.find((t) => t.id === id)?.desktopOnly)
                )
                .map((id) => {
                  const builtIn = TABS.find((t) => t.id === id);
                  const label =
                    builtIn?.label ??
                    (typeof id === "string" && id.startsWith("custom-")
                      ? (customLists.find((l) => getCustomListTabId(l.slug) === id)
                          ?.name ?? id)
                      : id);
                  return { id, label };
                })
                .sort((a, b) =>
                  a.label.localeCompare(b.label, undefined, {
                    sensitivity: "base",
                  })
                )
                .map(({ id, label }) => {
                  const visible = !hiddenSet.has(id);
                  const canDelete = tabOrder.length > 1;
                  return (
                    <li key={id} className="project-nav-filter-item">
                      <label className="project-nav-filter-label">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => {
                            const next = visible
                              ? [...hiddenTabIds, id]
                              : hiddenTabIds.filter((h) => h !== id);
                            setHiddenTabIds(next);
                          }}
                          aria-label={`${visible ? "Hide" : "Show"} ${label}`}
                        />
                        <span>{label}</span>
                      </label>
                      <button
                        type="button"
                        className="project-nav-filter-delete"
                        onClick={() => deleteTab(id)}
                        aria-label={`Delete ${label} tab`}
                        title={
                          canDelete
                            ? `Delete ${label} tab`
                            : "At least one tab must remain"
                        }
                        disabled={!canDelete}
                      >
                        <IconTrash />
                      </button>
                    </li>
                  );
                })}
              <li className="project-nav-filter-item project-nav-filter-restore-row">
                <button
                  type="button"
                  role="menuitem"
                  className="project-nav-add-menu-item project-nav-filter-restore-btn"
                  disabled={deletedTabIds.length === 0}
                  onClick={restoreDeletedTabs}
                  title={
                    deletedTabIds.length === 0
                      ? "No deleted tabs to restore"
                      : "Restore deleted tabs"
                  }
                  aria-label="Restore deleted tabs"
                >
                  Restore deleted tabs
                </button>
              </li>
            </ul>
          )}
          <button
            type="button"
            className={`project-nav-settings-section-toggle project-nav-settings-section-header${addSectionOpen ? " is-open" : ""}`}
            onClick={() => setAddSectionOpen((o) => !o)}
            aria-expanded={addSectionOpen}
            aria-label="Add"
          >
            <IconPlus />
          </button>
          {addSectionOpen && (
            <ul className="project-nav-add-menu-list" role="list">
              {onAddClick && (
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="project-nav-add-menu-item"
                    onClick={() => {
                      closeSettingsMenu();
                      onAddClick();
                    }}
                  >
                    Create Deck
                  </button>
                </li>
              )}
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="project-nav-add-menu-item"
                  onClick={() => {
                    closeSettingsMenu();
                    onOpenCreateListModal();
                  }}
                >
                  New list…
                </button>
              </li>
            </ul>
          )}
          <button
            type="button"
            role="menuitem"
            className="project-nav-settings-section-toggle"
            onClick={() => {
              if (onOpenAppearanceSettings) {
                onOpenAppearanceSettings();
              } else {
                onOpenSettingsRoute();
              }
            }}
            aria-label="Open appearance settings"
            title="Open appearance settings"
          >
            <span className="project-nav-theme-icon" aria-hidden>
              <IconSettings />
            </span>
          </button>
          {onDeleteProjectClick && (
            <>
              <button
                type="button"
                className={`project-nav-settings-section-toggle project-nav-settings-section-header${deleteProjectSectionOpen ? " is-open" : ""}`}
                onClick={() => setDeleteProjectSectionOpen((o) => !o)}
                aria-expanded={deleteProjectSectionOpen}
                aria-label="Delete project"
                title="Delete project"
              >
                <IconTrash />
              </button>
              {deleteProjectSectionOpen && (
                <button
                  type="button"
                  role="menuitem"
                  className="project-nav-add-menu-item project-nav-settings-delete-project"
                  disabled={!selectedProjectId || !projectsLength}
                  onClick={() => {
                    closeSettingsMenu();
                    onDeleteProjectClick();
                  }}
                  title={
                    !selectedProjectId || !projectsLength
                      ? "No project to delete"
                      : "Delete the Project"
                  }
                  aria-label="Delete the Project"
                >
                  Delete the Project
                </button>
              )}
            </>
          )}
        </div>
      )}
      <button
        type="button"
        className="project-nav-settings-btn"
        onClick={() => setSettingsMenuOpen((o) => !o)}
        aria-label="Settings"
        aria-expanded={settingsMenuOpen}
      >
        <IconSettings />
      </button>
    </div>
  );
}
