import React, { useMemo } from "react";
import { AppLayout } from "../components/AppLayout";
import { useProjectLayout } from "../lib/useProjectLayout";
import { useTheme } from "../pages/_app";
import type { AppearancePresetId } from "../lib/api";

const PRESET_DETAILS: Record<
  AppearancePresetId,
  { label: string; description: string }
> = {
  classic: {
    label: "Classic",
    description: "Original Idea Home palette.",
  },
  ocean: {
    label: "Ocean",
    description: "Cool blue and teal accents.",
  },
  forest: {
    label: "Forest",
    description: "Green-forward earthy tones.",
  },
};

const SETTINGS_SECTIONS = [
  {
    id: "overview",
    eyebrow: "System",
    title: "Workspace",
    description: "Current project context and saved preferences.",
  },
  {
    id: "appearance",
    eyebrow: "Display",
    title: "Appearance settings",
    description: "Preview palettes instantly and save the combination you want everywhere.",
  },
  {
    id: "assistant",
    eyebrow: "Automation",
    title: "Assistant",
    description: "Voice and model behavior are managed from the project drawer.",
  },
] as const;

export default function SettingsPage() {
  const layout = useProjectLayout();
  const {
    theme,
    setTheme,
    toggleTheme,
    appliedPresets,
    draftPresets,
    setDraftPreset,
    resetDraftPresets,
    saveAppearancePrefs,
    saveState,
    saveError,
  } = useTheme();

  const hasUnsavedChanges = useMemo(
    () =>
      appliedPresets.lightPreset !== draftPresets.lightPreset ||
      appliedPresets.darkPreset !== draftPresets.darkPreset,
    [appliedPresets, draftPresets]
  );

  const currentModeLabel = theme === "dark" ? "Dark mode" : "Light mode";
  const currentPresetLabel =
    PRESET_DETAILS[
      theme === "dark" ? draftPresets.darkPreset : draftPresets.lightPreset
    ].label;

  return (
    <AppLayout
      title="Settings"
      activeTab="settings"
      projectName={layout.projectDisplayName}
      projectId={layout.selectedProjectId || undefined}
      searchPlaceholder="Search project"
      drawerOpen={layout.drawerOpen}
      setDrawerOpen={layout.setDrawerOpen}
      projects={layout.projects}
      selectedProjectId={layout.selectedProjectId ?? ""}
      setSelectedProjectId={layout.setSelectedProjectId}
      editingProjectId={layout.editingProjectId}
      setEditingProjectId={layout.setEditingProjectId}
      editingProjectName={layout.editingProjectName}
      setEditingProjectName={layout.setEditingProjectName}
      saveProjectName={layout.saveProjectName}
      cancelEditProjectName={layout.cancelEditProjectName}
      projectNameInputRef={layout.projectNameInputRef}
      theme={theme}
      toggleTheme={toggleTheme}
      projectToDelete={layout.projectToDelete}
      setProjectToDelete={layout.setProjectToDelete}
      projectDeleting={layout.projectDeleting}
      handleDeleteProject={layout.handleDeleteProject}
      onCreateProject={layout.createProjectByName}
      onRenameProject={layout.renameProjectById}
    >
      <section className="settings-page" aria-label="Settings">
        <header className="settings-hero" id="overview">
          <div className="settings-hero-copy">
            <p className="settings-page-kicker">Control room</p>
            <h1 className="settings-page-title">Settings</h1>
            <p className="settings-page-subtitle">
              Tune appearance, confirm workspace context, and keep assistant controls in one place.
            </p>
          </div>
          <div className="settings-hero-status" aria-label="Current settings overview">
            <div className="settings-hero-stat">
              <span className="settings-hero-stat-label">Current mode</span>
              <strong>{currentModeLabel}</strong>
            </div>
            <div className="settings-hero-stat">
              <span className="settings-hero-stat-label">Live preset</span>
              <strong>{currentPresetLabel}</strong>
            </div>
            <div className="settings-hero-stat">
              <span className="settings-hero-stat-label">Project</span>
              <strong>{layout.projectDisplayName || "No project selected"}</strong>
            </div>
          </div>
        </header>

        <div className="settings-layout-grid">
          <nav className="settings-sidebar" aria-label="Settings sections">
            {SETTINGS_SECTIONS.map((section) => (
              <a key={section.id} className="settings-sidebar-link" href={`#${section.id}`}>
                <span className="settings-sidebar-link-eyebrow">{section.eyebrow}</span>
                <span className="settings-sidebar-link-title">{section.title}</span>
                <span className="settings-sidebar-link-description">{section.description}</span>
              </a>
            ))}
          </nav>

          <div className="settings-content">
            <section className="settings-panel" aria-labelledby="workspace-settings-title">
              <div className="settings-panel-heading">
                <p className="settings-panel-eyebrow">System</p>
                <h2 className="settings-panel-title" id="workspace-settings-title">
                  Workspace
                </h2>
              </div>
              <div className="settings-summary-grid">
                <article className="settings-summary-card">
                  <span className="settings-summary-label">Selected project</span>
                  <strong className="settings-summary-value">
                    {layout.projectDisplayName || "No project selected"}
                  </strong>
                  <p className="settings-summary-description">
                    Settings follow the project currently loaded in the main workspace.
                  </p>
                </article>
                <article className="settings-summary-card">
                  <span className="settings-summary-label">Unsaved appearance changes</span>
                  <strong className="settings-summary-value">
                    {hasUnsavedChanges ? "Pending" : "None"}
                  </strong>
                  <p className="settings-summary-description">
                    Preview updates apply immediately. Save to persist them across sessions.
                  </p>
                </article>
                <article className="settings-summary-card">
                  <span className="settings-summary-label">Theme status</span>
                  <strong className="settings-summary-value">{currentModeLabel}</strong>
                  <p className="settings-summary-description">
                    Use light and dark tabs below to tune each preset independently.
                  </p>
                </article>
              </div>
            </section>

            <section
              className="settings-panel settings-panel-accent"
              id="appearance"
              aria-label="Appearance settings"
            >
              <div className="settings-panel-heading">
                <p className="settings-panel-eyebrow">Display</p>
                <h2 className="settings-panel-title">Appearance settings</h2>
                <p className="settings-panel-description">
                  Preview color schemes instantly, then save to sync across devices.
                </p>
              </div>

              <div className="settings-mode-row" role="group" aria-label="Color mode">
                <button
                  type="button"
                  className={`settings-mode-btn${theme === "light" ? " is-active" : ""}`}
                  onClick={() => setTheme("light")}
                  aria-pressed={theme === "light"}
                >
                  Light mode
                </button>
                <button
                  type="button"
                  className={`settings-mode-btn${theme === "dark" ? " is-active" : ""}`}
                  onClick={() => setTheme("dark")}
                  aria-pressed={theme === "dark"}
                >
                  Dark mode
                </button>
              </div>

              <div className="settings-preset-grid">
                <div className="settings-preset-group" role="group" aria-label="Light preset">
                  <h3 className="settings-preset-group-title">Light preset</h3>
                  {Object.entries(PRESET_DETAILS).map(([presetId, def]) => {
                    const id = presetId as AppearancePresetId;
                    const selected = draftPresets.lightPreset === id;
                    return (
                      <button
                        key={`light-${id}`}
                        type="button"
                        className={`settings-preset-btn${selected ? " is-active" : ""}`}
                        onClick={() => setDraftPreset("light", id)}
                        aria-pressed={selected}
                        aria-label={`${def.label} (light)`}
                      >
                        <span className="settings-preset-label">{def.label}</span>
                        <span className="settings-preset-description">{def.description}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="settings-preset-group" role="group" aria-label="Dark preset">
                  <h3 className="settings-preset-group-title">Dark preset</h3>
                  {Object.entries(PRESET_DETAILS).map(([presetId, def]) => {
                    const id = presetId as AppearancePresetId;
                    const selected = draftPresets.darkPreset === id;
                    return (
                      <button
                        key={`dark-${id}`}
                        type="button"
                        className={`settings-preset-btn${selected ? " is-active" : ""}`}
                        onClick={() => setDraftPreset("dark", id)}
                        aria-pressed={selected}
                        aria-label={`${def.label} (dark)`}
                      >
                        <span className="settings-preset-label">{def.label}</span>
                        <span className="settings-preset-description">{def.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="settings-actions" role="group" aria-label="Appearance actions">
                <button
                  type="button"
                  className="ui-btn ui-btn--secondary"
                  onClick={resetDraftPresets}
                  disabled={!hasUnsavedChanges || saveState === "saving"}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ui-btn ui-btn--primary"
                  onClick={() => {
                    void saveAppearancePrefs();
                  }}
                  disabled={!hasUnsavedChanges || saveState === "saving"}
                >
                  {saveState === "saving" ? "Saving..." : "Save"}
                </button>
              </div>

              {saveState === "success" && !saveError ? (
                <p className="settings-status settings-status-success" role="status">
                  Appearance saved.
                </p>
              ) : null}
              {saveError ? (
                <p className="settings-status settings-status-warning" role="status">
                  {saveError}
                </p>
              ) : null}
            </section>

            <section
              className="settings-panel"
              id="assistant"
              aria-labelledby="assistant-settings-title"
            >
              <div className="settings-panel-heading">
                <p className="settings-panel-eyebrow">Automation</p>
                <h2 className="settings-panel-title" id="assistant-settings-title">
                  Assistant
                </h2>
              </div>
              <div className="settings-note-card">
                <strong className="settings-note-title">Voice and model controls live in the drawer.</strong>
                <p className="settings-note-copy">
                  Open the left project drawer to change the assistant voice or switch the active AI model.
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
