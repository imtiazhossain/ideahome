import React, { useEffect, useState } from "react";
import {
  setStoredAssistantVoiceUri,
  setStoredOpenRouterModel,
} from "../lib/api/auth";
import { IconTrash } from "./IconTrash";
import {
  IconBulbyHide,
  IconBulbyShow,
  IconFilter,
  IconHomeBulby,
  IconMic,
  IconSettings,
} from "./icons";
import {
  BULBY_TRIGGER_HIDDEN_KEY,
  BULBY_TRIGGER_VISIBILITY_EVENT,
} from "./BulbyChatbox";
import type { ProjectNavTabId } from "./ProjectNavBar";
import { UiSelect } from "./UiSelect";

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
  onToggleTabVisibility: (tabId: ProjectNavTabId, visible: boolean) => void;
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
  onOpenAppearanceSettings: () => void;
}

/**
 * Reusable left sidepanel (drawer) used by AppLayout. Same UI across all pages:
 * Projects list and bottom settings. Change this component once
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
  onToggleTabVisibility,
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
  onOpenAppearanceSettings,
}: AppDrawerProps) {
  const [bulbyTriggerHidden, setBulbyTriggerHidden] = useState(false);
  useEffect(() => {
    try {
      setBulbyTriggerHidden(
        window.localStorage.getItem(BULBY_TRIGGER_HIDDEN_KEY) === "1"
      );
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ hidden: boolean }>;
      if (ev.detail?.hidden !== undefined) setBulbyTriggerHidden(ev.detail.hidden);
    };
    window.addEventListener(BULBY_TRIGGER_VISIBILITY_EVENT, handler);
    return () =>
      window.removeEventListener(BULBY_TRIGGER_VISIBILITY_EVENT, handler);
  }, []);

  const toggleBulbyTrigger = () => {
    const next = !bulbyTriggerHidden;
    setBulbyTriggerHidden(next);
    if (next) window.localStorage.setItem(BULBY_TRIGGER_HIDDEN_KEY, "1");
    else window.localStorage.removeItem(BULBY_TRIGGER_HIDDEN_KEY);
    window.dispatchEvent(
      new CustomEvent(BULBY_TRIGGER_VISIBILITY_EVENT, { detail: { hidden: next } })
    );
  };

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
                  <button
                    type="button"
                    className={`drawer-nav-item ${selectedProjectId === p.id ? "is-selected" : ""}`}
                    onClick={() => {
                      setSelectedProjectId(p.id);
                      closeDrawerOnMobile();
                    }}
                  >
                    {p.name}
                  </button>
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
                  {showDeletePerProject && (
                    <button
                      type="button"
                      className="drawer-nav-item-delete is-visible"
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
                      onChange={() => onToggleTabVisibility(tabId, visible)}
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
                        <UiSelect
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
                        </UiSelect>
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
                        toggleBulbyTrigger();
                      }}
                      aria-label={
                        bulbyTriggerHidden
                          ? "Show Bulby chat"
                          : "Hide Bulby chat"
                      }
                      title={
                        bulbyTriggerHidden
                          ? "Show Bulby chat"
                          : "Hide Bulby chat"
                      }
                    >
                      {bulbyTriggerHidden ? (
                        <IconBulbyShow />
                      ) : (
                        <IconBulbyHide />
                      )}
                    </button>
                    <button
                      type="button"
                      className="drawer-bottom-settings-menu-item"
                      role="menuitem"
                      onClick={() => {
                        onOpenAppearanceSettings();
                        setDrawerSettingsOpen(false);
                        setDrawerFiltersOpen(false);
                        setDrawerVoicesOpen(false);
                        setDrawerDeleteSectionsOpen(false);
                      }}
                      aria-label="Open appearance settings"
                      title="Open appearance settings"
                    >
                      <IconSettings />
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
      ) : null}
    </aside>
  );
}
