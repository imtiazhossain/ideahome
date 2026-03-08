import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toUiTitleCase } from "@ideahome/shared";
import { AppLayout } from "../components/AppLayout";
import {
  BULBY_TRIGGER_HIDDEN_KEY,
  BULBY_TRIGGER_VISIBILITY_EVENT,
} from "../components/BulbyChatbox";
import { ConfirmModal } from "../components/ConfirmModal";
import { IconTrash } from "../components/IconTrash";
import { ProjectSettingsPanel } from "../components/ProjectSettingsPanel";
import { UiCheckbox } from "../components/UiCheckbox";
import { UiSelect } from "../components/UiSelect";
import { IconChevronDown, IconChevronUp } from "../components/icons";
import {
  loadTabOrder,
  TABS,
  useIsMobile,
  useTabOrder,
  type ProjectNavTabId,
} from "../components/project-nav/tab-order";
import {
  setStoredAssistantVoiceUri,
  setStoredOpenRouterModel,
} from "../lib/api";
import { deleteCustomTab, getCustomTabId } from "../lib/customTabs";
import { useCustomTabs } from "../lib/useCustomTabs";
import { CustomTabIconPreview } from "../components/CustomTabIcon";
import { useAssistantSettings } from "../lib/useAssistantSettings";
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
    id: "project",
    eyebrow: "Management",
    title: toUiTitleCase("project details"),
    description: "Manage project name, team members, invites, and deletion.",
  },
  {
    id: "overview",
    eyebrow: "System",
    title: toUiTitleCase("workspace"),
    description: "Current project context and saved preferences.",
  },
  {
    id: "appearance",
    eyebrow: "Display",
    title: toUiTitleCase("appearance settings"),
    description:
      "Preview palettes instantly and save the combination you want everywhere.",
  },
  {
    id: "navigation",
    eyebrow: "Structure",
    title: toUiTitleCase("navigation"),
    description:
      "Show, hide, reorder, and restore workspace sections from one place.",
  },
  {
    id: "assistant",
    eyebrow: "Automation",
    title: toUiTitleCase("assistant"),
    description:
      "Match the drawer controls for voice, model, and Bulby visibility.",
  },
] as const;

const SECTION_LINKS: {
  label: string;
  tabId: ProjectNavTabId;
}[] = [
  { tabId: "todo", label: toUiTitleCase("to-do") },
  { tabId: "ideas", label: toUiTitleCase("ideas") },
  { tabId: "enhancements", label: toUiTitleCase("enhancements") },
  { tabId: "summary", label: toUiTitleCase("summary") },
  { tabId: "timeline", label: toUiTitleCase("timeline") },
  { tabId: "board", label: toUiTitleCase("dashboard") },
  { tabId: "tests", label: toUiTitleCase("tests") },
  { tabId: "calendar", label: toUiTitleCase("calendar") },
  { tabId: "list", label: toUiTitleCase("features") },
  { tabId: "forms", label: toUiTitleCase("bugs") },
  { tabId: "goals", label: toUiTitleCase("goals") },
  { tabId: "expenses", label: toUiTitleCase("finances") },
  { tabId: "code", label: toUiTitleCase("code") },
  { tabId: "pages", label: toUiTitleCase("pages") },
  { tabId: "settings", label: toUiTitleCase("settings") },
];

function IconSun(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <circle cx="12" cy="12" r="4" strokeWidth="1.8" />
      <path
        d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23 5.46 5.46"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMoon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        d="M20 14.2A8 8 0 1 1 9.8 4a6.6 6.6 0 0 0 10.2 10.2Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function renderSettingsNavLabel(link: {
  label: string;
  isCustom?: boolean;
}) {
  return (
    <span className="settings-list-label" title={link.label}>
      {link.label}
    </span>
  );
}

type PendingCustomDelete = {
  tabId: ProjectNavTabId;
  slug: string;
  label: string;
};

export default function SettingsPage() {
  const layout = useProjectLayout();
  const isMobile = useIsMobile();
  const {
    tabOrder,
    setTabOrder,
    hiddenTabIds,
    setHiddenTabIds,
    deletedTabIds,
    setDeletedTabIds,
  } = useTabOrder();
  const {
    availableVoices,
    selectedVoiceUri,
    setSelectedVoiceUri,
    selectedVoiceLabel,
    openRouterModelOptions,
    selectedAiModel,
    setSelectedAiModel,
    canManageOpenRouterModel,
  } = useAssistantSettings();
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
  const customTabs = useCustomTabs(layout.selectedProjectId ?? "");
  const [bulbyTriggerHidden, setBulbyTriggerHidden] = useState(false);
  const [pendingCustomDelete, setPendingCustomDelete] =
    useState<PendingCustomDelete | null>(null);

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
  const hiddenSet = useMemo(() => new Set(hiddenTabIds), [hiddenTabIds]);

  const customTabsById = useMemo(
    () =>
      new Map(
        customTabs.map((entry) => [getCustomTabId(entry.slug), entry] as const)
      ),
    [customTabs]
  );

  useEffect(() => {
    try {
      setBulbyTriggerHidden(
        window.localStorage.getItem(BULBY_TRIGGER_HIDDEN_KEY) === "1"
      );
    } catch {
      /* ignore */
    }
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ hidden?: boolean }>).detail;
      if (typeof detail?.hidden === "boolean") {
        setBulbyTriggerHidden(detail.hidden);
      }
    };
    window.addEventListener(BULBY_TRIGGER_VISIBILITY_EVENT, handler);
    return () =>
      window.removeEventListener(BULBY_TRIGGER_VISIBILITY_EVENT, handler);
  }, []);

  const orderedNavLinks = useMemo(() => {
    const builtInById = new Map(
      SECTION_LINKS.map((link) => [link.tabId, link])
    );
    const ordered = tabOrder
      .map((id) => {
        const builtIn = builtInById.get(id);
        if (builtIn) return builtIn;
        const custom =
          typeof id === "string" && id.startsWith("custom-")
            ? customTabsById.get(id as `custom-${string}`)
            : null;
        if (!custom) return null;
        return { label: custom.name, tabId: id };
      })
      .filter(
        (
          link
        ): link is {
          label: string;
          tabId: ProjectNavTabId;
        } => Boolean(link)
      );
    const missing = SECTION_LINKS.filter(
      (link) => !ordered.some((item) => item.tabId === link.tabId)
    );
    return [...ordered, ...missing];
  }, [customTabsById, tabOrder]);

  const manageableNavLinks = useMemo(
    () =>
      orderedNavLinks.filter(
        (link) =>
          !(isMobile && TABS.find((tab) => tab.id === link.tabId)?.desktopOnly)
      ),
    [isMobile, orderedNavLinks]
  );

  const visibleNavLinks = useMemo(
    () =>
      manageableNavLinks.filter(
        (link) => tabOrder.includes(link.tabId) && !hiddenSet.has(link.tabId)
      ),
    [hiddenSet, manageableNavLinks, tabOrder]
  );

  const allVisibleNavLinks = useMemo(
    () =>
      manageableNavLinks.filter(
        (link) => tabOrder.includes(link.tabId) && !hiddenSet.has(link.tabId)
      ),
    [hiddenSet, manageableNavLinks, tabOrder]
  );

  const navSectionRows = useMemo(
    () =>
      manageableNavLinks.map((section) => {
        const custom =
          typeof section.tabId === "string" && section.tabId.startsWith("custom-")
            ? customTabsById.get(section.tabId as `custom-${string}`) ?? null
            : null;
        return {
          ...section,
          visible:
            tabOrder.includes(section.tabId) && !hiddenSet.has(section.tabId),
          isCustom: Boolean(custom),
          customKind: custom?.kind ?? null,
          customIcon: custom?.icon ?? null,
        };
      }),
    [customTabsById, hiddenSet, manageableNavLinks, tabOrder]
  );

  const customNavSectionRows = useMemo(
    () => navSectionRows.filter((section) => section.isCustom),
    [navSectionRows]
  );

  const moveNavTab = useCallback(
    (tabId: ProjectNavTabId, direction: "up" | "down") => {
      const visibleTabIds = allVisibleNavLinks.map((link) => link.tabId);
      const fromVisible = visibleTabIds.indexOf(tabId);
      if (fromVisible === -1) return;
      const toVisible = direction === "up" ? fromVisible - 1 : fromVisible + 1;
      if (toVisible < 0 || toVisible >= visibleTabIds.length) return;
      const swapId = visibleTabIds[toVisible];
      const from = tabOrder.indexOf(tabId);
      const to = tabOrder.indexOf(swapId);
      if (from === -1 || to === -1) return;
      const next = [...tabOrder];
      [next[from], next[to]] = [next[to], next[from]];
      setTabOrder(next);
    },
    [allVisibleNavLinks, setTabOrder, tabOrder]
  );

  const toggleTabVisibility = useCallback(
    (tabId: ProjectNavTabId, currentlyVisible: boolean) => {
      if (currentlyVisible) {
        if (!hiddenTabIds.includes(tabId)) {
          setHiddenTabIds([...hiddenTabIds, tabId]);
        }
        return;
      }

      const nextHidden = hiddenTabIds.filter((id) => id !== tabId);
      if (nextHidden.length !== hiddenTabIds.length) {
        setHiddenTabIds(nextHidden);
      }
      if (!tabOrder.includes(tabId)) {
        setTabOrder([...tabOrder, tabId]);
      }
      if (deletedTabIds.includes(tabId)) {
        setDeletedTabIds(deletedTabIds.filter((id) => id !== tabId));
      }
    },
    [
      deletedTabIds,
      hiddenTabIds,
      setDeletedTabIds,
      setHiddenTabIds,
      setTabOrder,
      tabOrder,
    ]
  );

  const deleteSectionTab = useCallback(
    (tabId: ProjectNavTabId) => {
      if (tabOrder.length <= 1) return;
      const nextOrder = tabOrder.filter((id) => id !== tabId);
      if (nextOrder.length === 0) return;
      setTabOrder(nextOrder);
      setHiddenTabIds(hiddenTabIds.filter((id) => id !== tabId));
      setDeletedTabIds(Array.from(new Set([...deletedTabIds, tabId])));
    },
    [
      deletedTabIds,
      hiddenTabIds,
      setDeletedTabIds,
      setHiddenTabIds,
      setTabOrder,
      tabOrder,
    ]
  );

  const restoreDeletedTabs = useCallback(() => {
    if (deletedTabIds.length === 0) return;
    setDeletedTabIds([]);
    setTabOrder(loadTabOrder([]));
  }, [deletedTabIds.length, setDeletedTabIds, setTabOrder]);

  const permanentlyDeleteCustomTab = useCallback(() => {
    if (!pendingCustomDelete || !layout.selectedProjectId) return;
    deleteCustomTab(layout.selectedProjectId, pendingCustomDelete.slug);
    setTabOrder(tabOrder.filter((id) => id !== pendingCustomDelete.tabId));
    setHiddenTabIds(
      hiddenTabIds.filter((id) => id !== pendingCustomDelete.tabId)
    );
    setDeletedTabIds(
      deletedTabIds.filter((id) => id !== pendingCustomDelete.tabId)
    );
    setPendingCustomDelete(null);
  }, [
    deletedTabIds,
    hiddenTabIds,
    layout.selectedProjectId,
    pendingCustomDelete,
    setDeletedTabIds,
    setHiddenTabIds,
    setTabOrder,
    tabOrder,
  ]);

  const toggleBulbyTrigger = useCallback(() => {
    const next = !bulbyTriggerHidden;
    setBulbyTriggerHidden(next);
    if (next) {
      window.localStorage.setItem(BULBY_TRIGGER_HIDDEN_KEY, "1");
    } else {
      window.localStorage.removeItem(BULBY_TRIGGER_HIDDEN_KEY);
    }
    window.dispatchEvent(
      new CustomEvent(BULBY_TRIGGER_VISIBILITY_EVENT, {
        detail: { hidden: next },
      })
    );
  }, [bulbyTriggerHidden]);

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
      {pendingCustomDelete ? (
        <ConfirmModal
          title="Permanently Delete Custom Section?"
          message={`"${pendingCustomDelete.label}" will be removed permanently. This also deletes its saved content and it cannot be restored.`}
          confirmLabel="Delete permanently"
          onClose={() => setPendingCustomDelete(null)}
          onConfirm={permanentlyDeleteCustomTab}
          danger
        />
      ) : null}
      <section className="settings-page" aria-label="Settings">
        <header className="settings-hero" id="overview">
          <div className="settings-hero-copy">
            <p className="settings-page-kicker">Control room</p>
            <h1 className="settings-page-title">Settings</h1>
            <p className="settings-page-subtitle">
              Tune appearance, confirm workspace context, and keep assistant
              controls in one place.
            </p>
          </div>
          <div
            className="settings-hero-status"
            aria-label="Current settings overview"
          >
            <div className="settings-hero-stat">
              <span className="settings-hero-stat-label">Project</span>
              <strong>
                {layout.projectDisplayName || "No project selected"}
              </strong>
            </div>
          </div>
        </header>

        <div className="settings-layout-grid">
          <nav className="settings-sidebar" aria-label="Settings sections">
            {SETTINGS_SECTIONS.map((section) => (
              <a
                key={section.id}
                className="settings-sidebar-link"
                href={`#${section.id}`}
              >
                <span className="settings-sidebar-link-eyebrow">
                  {section.eyebrow}
                </span>
                <span className="settings-sidebar-link-title">
                  {section.title}
                </span>
                <span className="settings-sidebar-link-description">
                  {section.description}
                </span>
              </a>
            ))}
          </nav>

          <div className="settings-content">
            <ProjectSettingsPanel
              projectId={layout.selectedProjectId ?? undefined}
              projectName={layout.projectDisplayName}
              onRenameProject={layout.renameProjectById}
              onDeleteProject={(id, name) => {
                layout.setProjectToDelete({ id, name });
              }}
            />

            <section
              className="settings-panel"
              aria-labelledby="workspace-settings-title"
            >
              <div className="settings-panel-heading">
                <p className="settings-panel-eyebrow">System</p>
                <h2
                  className="settings-panel-title"
                  id="workspace-settings-title"
                >
                  Workspace
                </h2>
              </div>
              <div className="settings-summary-grid">
                <article className="settings-summary-card">
                  <span className="settings-summary-label">
                    Selected project
                  </span>
                  <strong className="settings-summary-value">
                    {layout.projectDisplayName || "No project selected"}
                  </strong>
                  <p className="settings-summary-description">
                    Settings follow the project currently loaded in the main
                    workspace.
                  </p>
                </article>
                <article className="settings-summary-card">
                  <span className="settings-summary-label">
                    Unsaved appearance changes
                  </span>
                  <strong className="settings-summary-value">
                    {hasUnsavedChanges ? "Pending" : "None"}
                  </strong>
                  <p className="settings-summary-description">
                    Preview updates apply immediately. Save to persist them
                    across sessions.
                  </p>
                </article>
                <article className="settings-summary-card">
                  <span className="settings-summary-label">Theme status</span>
                  <strong className="settings-summary-value">
                    {currentModeLabel}
                  </strong>
                  <p className="settings-summary-description">
                    Use light and dark tabs below to tune each preset
                    independently.
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
                <h2 className="settings-panel-title">Appearance Settings</h2>
                <p className="settings-panel-description">
                  Preview color schemes instantly, then save to sync across
                  devices.
                </p>
              </div>

              <div
                className="settings-mode-row"
                role="group"
                aria-label="Color mode"
              >
                <button
                  type="button"
                  className={`settings-mode-btn${theme === "light" ? " is-active" : ""}`}
                  onClick={() => setTheme("light")}
                  aria-pressed={theme === "light"}
                >
                  <IconSun className="settings-mode-btn-icon" aria-hidden />
                  Light mode
                </button>
                <button
                  type="button"
                  className={`settings-mode-btn${theme === "dark" ? " is-active" : ""}`}
                  onClick={() => setTheme("dark")}
                  aria-pressed={theme === "dark"}
                >
                  <IconMoon className="settings-mode-btn-icon" aria-hidden />
                  Dark mode
                </button>
              </div>

              <div className="settings-preset-grid">
                <div
                  className="settings-preset-group"
                  role="group"
                  aria-label="Light preset"
                >
                  <h3 className="settings-preset-group-title">Light Preset</h3>
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
                        <span className="settings-preset-label">
                          {def.label}
                        </span>
                        <span className="settings-preset-description">
                          {def.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div
                  className="settings-preset-group"
                  role="group"
                  aria-label="Dark preset"
                >
                  <h3 className="settings-preset-group-title">Dark Preset</h3>
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
                        <span className="settings-preset-label">
                          {def.label}
                        </span>
                        <span className="settings-preset-description">
                          {def.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="settings-actions settings-actions-appearance"
                role="group"
                aria-label="Appearance actions"
              >
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
                <p
                  className="settings-status settings-status-success"
                  role="status"
                >
                  Appearance saved.
                </p>
              ) : null}
              {saveError ? (
                <p
                  className="settings-status settings-status-warning"
                  role="status"
                >
                  {saveError}
                </p>
              ) : null}
            </section>

            <section
              className="settings-panel"
              id="navigation"
              aria-labelledby="navigation-settings-title"
            >
              <div className="settings-panel-heading">
                <p className="settings-panel-eyebrow">Structure</p>
                <h2
                  className="settings-panel-title"
                  id="navigation-settings-title"
                >
                  Navigation
                </h2>
                <p className="settings-panel-description">
                  These controls mirror the drawer settings for section order,
                  visibility, and cleanup.
                </p>
              </div>

              <div className="settings-summary-grid settings-summary-grid-compact">
                <article className="settings-summary-card">
                  <span className="settings-summary-label">
                    Visible sections
                  </span>
                  <strong className="settings-summary-value">
                    {visibleNavLinks.length}
                  </strong>
                  <p className="settings-summary-description">
                    Hidden and deleted sections stay out of the main navigation
                    until restored.
                  </p>
                </article>
                <article className="settings-summary-card">
                  <span className="settings-summary-label">
                    Hidden sections
                  </span>
                  <strong className="settings-summary-value">
                    {hiddenTabIds.length}
                  </strong>
                  <p className="settings-summary-description">
                    Toggle visibility without losing the saved position of a
                    section.
                  </p>
                </article>
                <article className="settings-summary-card">
                  <span className="settings-summary-label">
                    Deleted sections
                  </span>
                  <strong className="settings-summary-value">
                    {deletedTabIds.length}
                  </strong>
                  <p className="settings-summary-description">
                    Restore everything in one step if you want the full default
                    set back.
                  </p>
                </article>
              </div>

              <div className="settings-tool-grid">
                <article className="settings-tool-card">
                  <div className="settings-tool-heading">
                    <h3 className="settings-tool-title">Visible Order</h3>
                    <p className="settings-tool-description">
                      Reorder the sections that are currently shown in the
                      workspace.
                    </p>
                  </div>
                  <div
                    className="settings-list"
                    role="list"
                    aria-label="Visible navigation order"
                  >
                    {visibleNavLinks.map((link, index) => (
                      <div
                        key={link.tabId}
                        className="settings-list-row"
                        role="listitem"
                      >
                        {renderSettingsNavLabel({
                          ...link,
                          isCustom:
                            typeof link.tabId === "string" &&
                            link.tabId.startsWith("custom-"),
                        })}
                        <div className="settings-list-actions">
                          {typeof link.tabId === "string" &&
                          link.tabId.startsWith("custom-") ? (
                            <span className="settings-list-badge" title="Custom">
                              C
                            </span>
                          ) : null}
                          <button
                            type="button"
                            className="settings-mini-btn"
                            onClick={() => moveNavTab(link.tabId, "up")}
                            disabled={index === 0}
                            aria-label={`Move ${link.label} up`}
                          >
                            <IconChevronUp />
                          </button>
                          <button
                            type="button"
                            className="settings-mini-btn"
                            onClick={() => moveNavTab(link.tabId, "down")}
                            disabled={index === visibleNavLinks.length - 1}
                            aria-label={`Move ${link.label} down`}
                          >
                            <IconChevronDown />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="settings-tool-card">
                  <div className="settings-tool-heading">
                    <h3 className="settings-tool-title">
                      Show or Hide Sections
                    </h3>
                    <p className="settings-tool-description">
                      Bring deleted sections back by turning them on again here.
                    </p>
                  </div>
                  <div
                    className="settings-list"
                    role="list"
                    aria-label="Section visibility"
                  >
                    {navSectionRows.map((section) => (
                      <div
                        key={section.tabId}
                        className="settings-list-row"
                        role="listitem"
                      >
                        {renderSettingsNavLabel(section)}
                        <div className="settings-list-actions">
                          {section.isCustom ? (
                            <span className="settings-list-badge" title="Custom">
                              C
                            </span>
                          ) : null}
                        <UiCheckbox
                          checked={section.visible}
                          onChange={() =>
                            toggleTabVisibility(section.tabId, section.visible)
                          }
                          aria-label={`${section.visible ? "Hide" : "Show"} ${section.label}`}
                        />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="settings-tool-card">
                  <div className="settings-tool-heading">
                    <h3 className="settings-tool-title">Delete Custom Sections</h3>
                    <p className="settings-tool-description">
                      Permanently remove custom sections and their saved content.
                    </p>
                  </div>
                  <div
                    className="settings-list"
                    role="list"
                    aria-label="Delete custom navigation sections"
                  >
                    {customNavSectionRows.map((link) => {
                      const customTab =
                        typeof link.tabId === "string" &&
                        link.tabId.startsWith("custom-")
                          ? customTabsById.get(link.tabId as `custom-${string}`) ??
                            null
                          : null;
                      return (
                        <div
                          key={link.tabId}
                          className="settings-list-row"
                          role="listitem"
                        >
                          {renderSettingsNavLabel(link)}
                          <div className="settings-list-actions">
                            {link.isCustom ? (
                              <span className="settings-list-badge" title="Custom">
                                C
                              </span>
                            ) : null}
                            {customTab ? (
                              <button
                                type="button"
                                className="settings-mini-btn settings-mini-btn-danger"
                                onClick={() =>
                                  setPendingCustomDelete({
                                    tabId: link.tabId,
                                    slug: customTab.slug,
                                    label: customTab.name,
                                  })
                                }
                                aria-label={`Delete ${link.label}`}
                                title={`Delete ${link.label}`}
                              >
                                <IconTrash />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              </div>
            </section>

            <section
              className="settings-panel"
              id="assistant"
              aria-labelledby="assistant-settings-title"
            >
              <div className="settings-panel-heading">
                <p className="settings-panel-eyebrow">Automation</p>
                <h2
                  className="settings-panel-title"
                  id="assistant-settings-title"
                >
                  Assistant
                </h2>
                <p className="settings-panel-description">
                  The drawer controls now live here too, including voice, model,
                  and Bulby visibility.
                </p>
              </div>

              <div className="settings-tool-grid settings-tool-grid-assistant">
                <article className="settings-tool-card">
                  <div className="settings-tool-heading">
                    <h3 className="settings-tool-title">Assistant Voice</h3>
                    <p className="settings-tool-description">
                      Current selection: {selectedVoiceLabel}
                    </p>
                  </div>
                  {availableVoices.length > 0 ? (
                    <label className="settings-field">
                      <span className="settings-field-label">Voice</span>
                      <UiSelect
                        value={selectedVoiceUri}
                        onChange={(event) => {
                          const nextVoice = event.target.value;
                          setSelectedVoiceUri(nextVoice);
                          setStoredAssistantVoiceUri(nextVoice);
                        }}
                        aria-label="Assistant voice"
                      >
                        {availableVoices.map((voice) => (
                          <option key={voice.value} value={voice.value}>
                            {voice.label}
                          </option>
                        ))}
                      </UiSelect>
                    </label>
                  ) : (
                    <div className="settings-note-card">
                      <strong className="settings-note-title">
                        No Voices Available Yet.
                      </strong>
                      <p className="settings-note-copy">
                        Browser and ElevenLabs voices will appear here when they
                        are ready.
                      </p>
                    </div>
                  )}
                </article>

                <article className="settings-tool-card">
                  <div className="settings-tool-heading">
                    <h3 className="settings-tool-title">AI Model</h3>
                    <p className="settings-tool-description">
                      {canManageOpenRouterModel
                        ? "Choose the OpenRouter model used for assistant responses."
                        : "Model switching is only enabled for approved accounts."}
                    </p>
                  </div>
                  {canManageOpenRouterModel ? (
                    <label className="settings-field">
                      <span className="settings-field-label">Model</span>
                      <UiSelect
                        value={selectedAiModel}
                        onChange={(event) => {
                          const nextModel = event.target.value;
                          setSelectedAiModel(nextModel);
                          setStoredOpenRouterModel(nextModel);
                        }}
                        aria-label="OpenRouter model"
                      >
                        {openRouterModelOptions.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </UiSelect>
                    </label>
                  ) : (
                    <div className="settings-note-card">
                      <strong className="settings-note-title">
                        Model Follows Your Account.
                      </strong>
                      <p className="settings-note-copy">
                        Nothing is missing here. The switcher only appears for
                        accounts allowed to change the active model.
                      </p>
                    </div>
                  )}
                </article>

                <article className="settings-tool-card">
                  <div className="settings-tool-heading">
                    <h3 className="settings-tool-title">Bulby Chat Trigger</h3>
                    <p className="settings-tool-description">
                      Hide or show the floating Bulby launcher across the app.
                    </p>
                  </div>
                  <div className="settings-note-card">
                    <strong className="settings-note-title">
                      {bulbyTriggerHidden
                        ? "Bulby Launcher Is Hidden."
                        : "Bulby Launcher Is Visible."}
                    </strong>
                    <p className="settings-note-copy">
                      This matches the eye toggle from the drawer settings
                      stack.
                    </p>
                  </div>
                  <div className="settings-tool-action">
                    <button
                      type="button"
                      className="ui-btn ui-btn--secondary"
                      onClick={toggleBulbyTrigger}
                    >
                      {bulbyTriggerHidden
                        ? "Show Bulby chat"
                        : "Hide Bulby chat"}
                    </button>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
