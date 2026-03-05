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

  return (
    <AppLayout
      title="Settings"
      activeTab="board"
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
      <section className="settings-page" aria-label="Appearance settings">
        <h1 className="settings-page-title">Appearance settings</h1>
        <p className="settings-page-subtitle">
          Preview color schemes instantly, then save to sync across devices.
        </p>

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
            <h2 className="settings-preset-group-title">Light preset</h2>
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
            <h2 className="settings-preset-group-title">Dark preset</h2>
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
    </AppLayout>
  );
}
