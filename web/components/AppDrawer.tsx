import React from "react";
import Link from "next/link";
import {
  setStoredAssistantVoiceUri,
  setStoredOpenRouterModel,
} from "../lib/api/auth";
import { IconTrash } from "./IconTrash";
import { IconFilter, IconMic, IconSettings } from "./icons";
import { IconHomeBulby } from "./icons";
import { DrawerCollapsedNav } from "./ProjectNavBar";
import type { ProjectNavTabId } from "./ProjectNavBar";

export interface AppDrawerNavLink {
  href?: string;
  label: string;
  tabId: ProjectNavTabId;
}

export interface AppDrawerProps {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  activeTab: ProjectNavTabId;
  /** Ordered list of projects for the Projects section */
  orderedProjects: { id: string; name: string }[];
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  editingProjectId: string | null;
  setEditingProjectId: (id: string | null) => void;
  editingProjectName: string;
  setEditingProjectName: (name: string) => void;
  saveProjectName: () => void;
  cancelEditProjectName: () => void;
  projectNameInputRef: React.RefObject<HTMLInputElement | null>;
  theme: string;
  toggleTheme: () => void;
  showDeletePerProject?: boolean;
  handleDeleteProject: (project: { id: string; name: string }) => Promise<void>;
  projectDeleting: boolean;
  moveProject: (projectId: string, direction: "up" | "down") => void;
  visibleOrderedNavLinks: AppDrawerNavLink[];
  moveNavTab: (tabId: ProjectNavTabId, direction: "up" | "down") => void;
  onAddProject: () => void;
  onAddTab: () => void;
  closeDrawerOnMobile: () => void;
  /** Creating project inline */
  creatingProject: boolean;
  creatingProjectName: string;
  setCreatingProjectName: (name: string) => void;
  creatingProjectInputRef: React.RefObject<HTMLInputElement | null>;
  submitNewProject: () => void | Promise<void>;
  onCancelCreatingProject?: () => void;
  /** Creating section inline */
  creatingSection: boolean;
  creatingSectionName: string;
  setCreatingSectionName: (name: string) => void;
  creatingSectionInputRef: React.RefObject<HTMLInputElement | null>;
  submitNewSection: () => void;
  onCancelCreatingSection?: () => void;
  /** Settings panel state (owned by parent) */
  drawerSettingsRef: React.RefObject<HTMLDivElement | null>;
  drawerSettingsOpen: boolean;
  setDrawerSettingsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  drawerFiltersOpen: boolean;
  setDrawerFiltersOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  drawerVoicesOpen: boolean;
  setDrawerVoicesOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  drawerDeleteSectionsOpen: boolean;
  setDrawerDeleteSectionsOpen: (
    open: boolean | ((prev: boolean) => boolean)
  ) => void;
  sortedFilterSections: Array<{
    tabId: ProjectNavTabId;
    label: string;
    visible: boolean;
  }>;
  hiddenTabIds: ProjectNavTabId[];
  setHiddenTabIds: (ids: ProjectNavTabId[]) => void;
  availableVoices: Array<{ value: string; label: string }>;
  selectedVoiceUri: string;
  setSelectedVoiceUri: (uri: string) => void;
  selectedVoiceLabel: string;
  openRouterModelOptions: string[];
  selectedAiModel: string;
  setSelectedAiModel: (model: string) => void;
  canManageOpenRouterModel: boolean;
  orderedNavLinks: AppDrawerNavLink[];
  tabOrderLength: number;
  deleteSectionTab: (tabId: ProjectNavTabId) => void;
}

/**
 * Reusable left sidepanel (drawer) used by AppLayout. Same UI across all pages:
 * Projects list, Sections nav, and bottom settings. Change this component once
 * to update the sidebar everywhere.
 */
export function AppDrawer({
  drawerOpen,
  setDrawerOpen,
  activeTab,
  orderedProjects,
  selectedProjectId,
  setSelectedProjectId,
  editingProjectId,
  setEditingProjectId,
  editingProjectName,
  setEditingProjectName,
  saveProjectName,
  cancelEditProjectName,
  projectNameInputRef,
  theme,
  toggleTheme,
  showDeletePerProject = false,
  handleDeleteProject,
  projectDeleting,
  moveProject,
  visibleOrderedNavLinks,
  moveNavTab,
  onAddProject,
  onAddTab,
  closeDrawerOnMobile,
  creatingProject,
  creatingProjectName,
  setCreatingProjectName,
  creatingProjectInputRef,
  submitNewProject,
  onCancelCreatingProject,
  creatingSection,
  creatingSectionName,
  setCreatingSectionName,
  creatingSectionInputRef,
  submitNewSection,
  onCancelCreatingSection,
  drawerSettingsRef,
  drawerSettingsOpen,
  setDrawerSettingsOpen,
  drawerFiltersOpen,
  setDrawerFiltersOpen,
  drawerVoicesOpen,
  setDrawerVoicesOpen,
  drawerDeleteSectionsOpen,
  setDrawerDeleteSectionsOpen,
  sortedFilterSections,
  hiddenTabIds,
  setHiddenTabIds,
  availableVoices,
  selectedVoiceUri,
  setSelectedVoiceUri,
  selectedVoiceLabel,
  openRouterModelOptions,
  selectedAiModel,
  setSelectedAiModel,
  canManageOpenRouterModel,
  orderedNavLinks,
  tabOrderLength,
  deleteSectionTab,
}: AppDrawerProps) {
  return (
    <aside
      className={`drawer ${drawerOpen ? "drawer-open" : "drawer-closed"}`}
      aria-label="App sidebar"
    >
      {drawerOpen ? (
        <>
          <div className="drawer-header">
            <div className="drawer-brand">
              <button
                type="button"
                className="drawer-toggle drawer-logo project-nav-drawer-toggle"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close sidebar"
                title="Close sidebar"
              >
                <span
                  className="drawer-logo-mark"
                  role="img"
                  aria-hidden="true"
                >
                  <IconHomeBulby />
                </span>
              </button>
              <div className="drawer-brand-title">Idea Home</div>
            </div>
          </div>
          <div className="drawer-content">
            <nav className="drawer-nav">
              <div className="drawer-nav-label-row">
                <div className="drawer-nav-label">Projects</div>
                <button
                  type="button"
                  className="drawer-nav-label-add-btn"
                  onClick={onAddProject}
                  aria-label="Add project"
                  title="Add project"
                >
                  +
                </button>
              </div>
              {creatingProject && (
                <div className="drawer-nav-item-row">
                  <input
                    ref={creatingProjectInputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    className="drawer-nav-item drawer-nav-item-input"
                    value={creatingProjectName}
                    onChange={(e) => setCreatingProjectName(e.target.value)}
                    onBlur={() => {
                      void submitNewProject();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void submitNewProject();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        onCancelCreatingProject?.();
                      }
                    }}
                    placeholder="Project Name?"
                    aria-label="Project Name"
                  />
                </div>
              )}
              {orderedProjects.map((p) => (
                <div key={p.id} className="drawer-nav-item-row">
                  {editingProjectId === p.id ? (
                    <input
                      ref={
                        projectNameInputRef as React.RefObject<HTMLInputElement>
                      }
                      type="text"
                      className="drawer-nav-item drawer-nav-item-input"
                      value={editingProjectName}
                      onChange={(e) =>
                        setEditingProjectName(e.target.value)
                      }
                      onBlur={saveProjectName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveProjectName();
                        if (e.key === "Escape") cancelEditProjectName();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Project name"
                    />
                  ) : (
                    <button
                      type="button"
                      className={`drawer-nav-item ${selectedProjectId === p.id ? "is-selected" : ""}`}
                      onClick={() => {
                        setSelectedProjectId(p.id);
                        closeDrawerOnMobile();
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingProjectId(p.id);
                        setEditingProjectName(p.name);
                      }}
                      title="Double-click to edit name"
                    >
                      {p.name}
                    </button>
                  )}
                  {editingProjectId !== p.id && (
                    <button
                      type="button"
                      className="drawer-nav-item-edit"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingProjectId(p.id);
                        setEditingProjectName(p.name);
                      }}
                      aria-label={`Rename ${p.name}`}
                      title={`Rename project "${p.name}"`}
                    >
                      ✎
                    </button>
                  )}
                  {editingProjectId !== p.id && (
                    <span className="drawer-nav-row-actions">
                      <button
                        type="button"
                        className="drawer-nav-item-reorder"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          moveProject(p.id, "up");
                        }}
                        aria-label={`Move ${p.name} up`}
                        title="Move up"
                        disabled={orderedProjects[0]?.id === p.id}
                      >
                        ▲
                      </button>
                    </span>
                  )}
                  {(showDeletePerProject || editingProjectId === p.id) && (
                    <button
                      type="button"
                      className={`drawer-nav-item-delete${showDeletePerProject || editingProjectId === p.id ? " is-visible" : ""}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleDeleteProject(p);
                        closeDrawerOnMobile();
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleDeleteProject(p);
                        closeDrawerOnMobile();
                      }}
                      disabled={projectDeleting}
                      aria-label={`Delete ${p.name}`}
                      title={`Delete project "${p.name}"`}
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              ))}
              <div className="drawer-nav-label-row drawer-nav-label-row-sections">
                <div className="drawer-nav-label">Sections</div>
                <button
                  type="button"
                  className="drawer-nav-label-add-btn"
                  onClick={onAddTab}
                  aria-label="Add tab"
                  title="Add tab"
                >
                  +
                </button>
              </div>
              {creatingSection && (
                <div className="drawer-nav-section-row">
                  <input
                    ref={creatingSectionInputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    className="drawer-nav-item drawer-nav-item-input"
                    value={creatingSectionName}
                    onChange={(e) => setCreatingSectionName(e.target.value)}
                    onBlur={submitNewSection}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitNewSection();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        onCancelCreatingSection?.();
                      }
                    }}
                    placeholder="Section Name?"
                    aria-label="Section Name"
                  />
                </div>
              )}
              {visibleOrderedNavLinks.map(({ href, label, tabId }) => (
                <div key={tabId} className="drawer-nav-section-row">
                  {href ? (
                    <Link
                      href={href}
                      prefetch={false}
                      onClick={closeDrawerOnMobile}
                      className={`drawer-nav-item ${activeTab === tabId ? "is-selected" : ""}`}
                    >
                      {label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={`drawer-nav-item ${activeTab === tabId ? "is-selected" : ""}`}
                      onClick={() => {}}
                      title={label}
                    >
                      {label}
                    </button>
                  )}
                  <span className="drawer-nav-row-actions">
                    <button
                      type="button"
                      className="drawer-nav-item-reorder"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        moveNavTab(tabId, "up");
                      }}
                      aria-label={`Move ${label} up`}
                      title="Move up"
                      disabled={visibleOrderedNavLinks[0]?.tabId === tabId}
                    >
                      ▲
                    </button>
                  </span>
                </div>
              ))}
            </nav>
          </div>
          <div className="drawer-bottom-settings" ref={drawerSettingsRef as React.RefObject<HTMLDivElement>}>
            {drawerFiltersOpen && (
              <div className="drawer-bottom-filter-menu">
                {sortedFilterSections.map(({ tabId, label, visible }) => (
                  <label key={tabId} className="drawer-bottom-filter-item">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => {
                        const next = visible
                          ? [...hiddenTabIds, tabId]
                          : hiddenTabIds.filter((id) => id !== tabId);
                        setHiddenTabIds(next);
                      }}
                      aria-label={`${visible ? "Hide" : "Show"} ${label}`}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}
            {drawerVoicesOpen && (
              <div className="drawer-bottom-voices-menu">
                {availableVoices.map((voice) => {
                  const selected = voice.value === selectedVoiceUri;
                  return (
                    <button
                      key={voice.value}
                      type="button"
                      className={`drawer-bottom-voice-item${selected ? " is-selected" : ""}`}
                      onClick={() => {
                        setSelectedVoiceUri(voice.value);
                        setStoredAssistantVoiceUri(voice.value);
                        setDrawerVoicesOpen(false);
                      }}
                      title={voice.label}
                      aria-label={voice.label}
                    >
                      {selected ? "✓ " : ""}
                      {voice.label}
                    </button>
                  );
                })}
              </div>
            )}
            {drawerDeleteSectionsOpen && (
              <div className="drawer-bottom-delete-sections-menu">
                {orderedNavLinks.map(({ tabId, label }) => {
                  const canDelete = tabOrderLength > 1;
                  return (
                    <div key={tabId} className="drawer-bottom-delete-row">
                      <span>{label}</span>
                      <button
                        type="button"
                        className="drawer-bottom-delete-btn"
                        onClick={() => deleteSectionTab(tabId)}
                        aria-label={`Delete ${label}`}
                        title={
                          canDelete
                            ? `Delete ${label}`
                            : "At least one section must remain"
                        }
                        disabled={!canDelete}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {drawerSettingsOpen && (
              <div className="drawer-bottom-settings-menu" role="menu">
                {drawerVoicesOpen ? (
                  <button
                    type="button"
                    className="drawer-bottom-settings-menu-item is-source-active"
                    role="menuitem"
                    onClick={() => {
                      setDrawerVoicesOpen(false);
                    }}
                    aria-label="Assistant voice"
                    title={`Voice: ${selectedVoiceLabel}`}
                  >
                    <span
                      className="drawer-bottom-settings-voice-icon"
                      aria-hidden
                    >
                      <span className="drawer-bottom-settings-voice-gear">
                        <IconSettings />
                      </span>
                      <span className="drawer-bottom-settings-voice-mic">
                        <IconMic />
                      </span>
                    </span>
                  </button>
                ) : drawerFiltersOpen ? (
                  <button
                    type="button"
                    className="drawer-bottom-settings-menu-item is-source-active"
                    role="menuitem"
                    onClick={() => {
                      setDrawerFiltersOpen(false);
                    }}
                    aria-label="Manage tabs"
                    title="Manage tabs"
                  >
                    <IconFilter />
                  </button>
                ) : drawerDeleteSectionsOpen ? (
                  <button
                    type="button"
                    className="drawer-bottom-settings-menu-item is-source-active"
                    role="menuitem"
                    onClick={() => {
                      setDrawerDeleteSectionsOpen(false);
                    }}
                    aria-label="Delete sections"
                    title="Delete sections"
                  >
                    <IconTrash />
                  </button>
                ) : (
                  <>
                    {availableVoices.length > 0 && (
                      <button
                        type="button"
                        className="drawer-bottom-settings-menu-item drawer-bottom-settings-voice"
                        role="menuitem"
                        aria-label="Assistant voice"
                        title={`Voice: ${selectedVoiceLabel}`}
                        onClick={() => {
                          setDrawerVoicesOpen((open) => !open);
                          setDrawerFiltersOpen(false);
                          setDrawerDeleteSectionsOpen(false);
                        }}
                      >
                        <span className="drawer-bottom-settings-voice-icon" aria-hidden>
                          <span className="drawer-bottom-settings-voice-gear">
                            <IconSettings />
                          </span>
                          <span className="drawer-bottom-settings-voice-mic">
                            <IconMic />
                          </span>
                        </span>
                      </button>
                    )}
                    {canManageOpenRouterModel && (
                      <label
                        className="drawer-bottom-settings-model"
                        aria-label="OpenRouter model"
                      >
                        <span className="drawer-bottom-settings-model-label">
                          LLM
                        </span>
                        <select
                          className="drawer-bottom-settings-model-select"
                          value={selectedAiModel}
                          onChange={(e) => {
                            const nextModel = e.target.value;
                            setSelectedAiModel(nextModel);
                            setStoredOpenRouterModel(nextModel);
                          }}
                        >
                          {openRouterModelOptions.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button
                      type="button"
                      className="drawer-bottom-settings-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setDrawerFiltersOpen((open) => !open);
                        setDrawerVoicesOpen(false);
                        setDrawerDeleteSectionsOpen(false);
                      }}
                      aria-label="Manage tabs"
                      title="Manage tabs"
                    >
                      <IconFilter />
                    </button>
                    <button
                      type="button"
                      className="drawer-bottom-settings-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setDrawerDeleteSectionsOpen((open) => !open);
                        setDrawerFiltersOpen(false);
                        setDrawerVoicesOpen(false);
                      }}
                      aria-label="Delete sections"
                      title="Delete sections"
                    >
                      <IconTrash />
                    </button>
                    <button
                      type="button"
                      className="drawer-bottom-settings-menu-item"
                      role="menuitem"
                      onClick={() => {
                        toggleTheme();
                        setDrawerSettingsOpen(false);
                        setDrawerFiltersOpen(false);
                        setDrawerVoicesOpen(false);
                        setDrawerDeleteSectionsOpen(false);
                      }}
                      aria-label={
                        theme === "light"
                          ? "Switch to dark theme"
                          : "Switch to light theme"
                      }
                      title={
                        theme === "light"
                          ? "Switch to dark theme"
                          : "Switch to light theme"
                      }
                    >
                      {theme === "light" ? "☀" : "🌙"}
                    </button>
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              className={`drawer-bottom-settings-btn${drawerSettingsOpen ? " is-open" : ""}`}
              onClick={() => {
                setDrawerSettingsOpen((open) => {
                  const next = !open;
                  if (!next) {
                    setDrawerFiltersOpen(false);
                    setDrawerVoicesOpen(false);
                    setDrawerDeleteSectionsOpen(false);
                  }
                  return next;
                });
              }}
              aria-label="Settings"
              title="Settings"
            >
              ⚙
            </button>
          </div>
        </>
      ) : (
        <DrawerCollapsedNav
          activeTab={activeTab}
          onExpand={() => setDrawerOpen(true)}
        />
      )}
    </aside>
  );
}
