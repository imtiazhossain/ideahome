import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  AUTH_CHANGE_EVENT,
  ASSISTANT_VOICE_CHANGE_EVENT,
  getStoredAssistantVoiceUri,
  getStoredOpenRouterModel,
  getUserEmailFromToken,
  getUserScopedStorageKey,
  setStoredAssistantVoiceUri,
  setStoredOpenRouterModel,
} from "../lib/api/auth";
import { fetchElevenLabsVoices, fetchOpenRouterModels } from "../lib/api";
import {
  safeLocalStorageGetJson,
  safeLocalStorageSetJson,
} from "../lib/storage";
import {
  addCustomList,
  getCustomListTabId,
  getCustomLists,
} from "../lib/customLists";
import { AppDrawer } from "./AppDrawer";
import { BulbyChatbox } from "./BulbyChatbox";
import { ProjectNavBar, useIsMobile, useTabOrder } from "./ProjectNavBar";
import type { ProjectNavTabId } from "./ProjectNavBar";

const SECTION_LINKS: {
  href?: string;
  label: string;
  tabId: ProjectNavTabId;
}[] = [
  { tabId: "todo", label: "To-Do", href: "/todo" },
  { tabId: "ideas", label: "Ideas", href: "/ideas" },
  { tabId: "enhancements", label: "Enhancements", href: "/enhancements" },
  { tabId: "summary", label: "Summary" },
  { tabId: "timeline", label: "Timeline" },
  { tabId: "board", label: "Dashboard", href: "/" },
  { tabId: "tests", label: "Tests", href: "/tests" },
  { tabId: "calendar", label: "Calendar" },
  { tabId: "list", label: "Features", href: "/features" },
  { tabId: "forms", label: "Bugs", href: "/bugs" },
  { tabId: "goals", label: "Goals" },
  { tabId: "development", label: "Code Health", href: "/coverage" },
  { tabId: "expenses", label: "Expenses", href: "/expenses" },
  { tabId: "code", label: "Code", href: "/code" },
  { tabId: "pages", label: "Pages" },
];

const PROJECT_ORDER_STORAGE_PREFIX = "ideahome-drawer-project-order";
const PROJECT_ORDER_LEGACY_KEY = "ideahome-drawer-project-order";
const DEFAULT_OPENROUTER_MODELS = ["openai/gpt-4o-mini", "openai/gpt-5-mini"];

function parseCsvValues(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

const INITIAL_OPENROUTER_MODEL_OPTIONS = (() => {
  const fromEnv = parseCsvValues(
    process.env.NEXT_PUBLIC_OPENROUTER_MODEL_OPTIONS
  );
  return fromEnv.length > 0 ? fromEnv : DEFAULT_OPENROUTER_MODELS;
})();

const OPENROUTER_MODEL_SWITCHER_EMAILS = new Set(
  parseCsvValues(process.env.NEXT_PUBLIC_OPENROUTER_MODEL_SWITCHER_EMAILS).map(
    (email) => email.toLowerCase()
  )
);

function getProjectOrderStorageKey(): string {
  return getUserScopedStorageKey(
    PROJECT_ORDER_STORAGE_PREFIX,
    PROJECT_ORDER_LEGACY_KEY
  );
}

function mergeProjectOrder(
  projects: { id: string; name: string }[],
  orderIds: string[]
): string[] {
  const validIds = new Set(projects.map((p) => p.id));
  const deduped = orderIds.filter(
    (id, idx) => validIds.has(id) && orderIds.indexOf(id) === idx
  );
  const missing = projects
    .map((p) => p.id)
    .filter((id) => !deduped.includes(id));
  return [...deduped, ...missing];
}

function loadProjectOrderIds(): string[] {
  if (typeof window === "undefined") return [];
  const parsed = safeLocalStorageGetJson<unknown[]>(
    getProjectOrderStorageKey(),
    (value): value is unknown[] => Array.isArray(value)
  );
  if (!parsed) return [];
  return parsed.filter((id): id is string => typeof id === "string");
}

function saveProjectOrderIds(ids: string[]) {
  if (typeof window === "undefined") return;
  safeLocalStorageSetJson(getProjectOrderStorageKey(), ids);
}

export interface AppLayoutProps {
  title: string;
  activeTab: ProjectNavTabId;
  projectName: string;
  projectId: string | undefined;
  searchPlaceholder: string;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  projects: { id: string; name: string }[];
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
  projectToDelete: { id: string; name: string } | null;
  setProjectToDelete: (p: { id: string; name: string } | null) => void;
  projectDeleting: boolean;
  handleDeleteProject: (
    project?: { id: string; name: string } | null
  ) => Promise<void>;
  /** When true, show delete button next to each project in the drawer */
  showDeletePerProject?: boolean;
  /** When provided, show "+ New project" button in drawer that calls this */
  onNewProjectClick?: () => void;
  /** Pass through to ProjectNavBar */
  onAddClick?: () => void;
  /** Override default create project (router.push). When provided, used instead. */
  onCreateProject?: (name: string) => void | Promise<void>;
  /** Pass through to ProjectNavBar */
  onDeleteAllIssuesClick?: () => void;
  /** Pass through to ProjectNavBar */
  deleteAllIssuesDisabled?: boolean;
  children: React.ReactNode;
}

export function AppLayout({
  title,
  activeTab,
  projectName,
  projectId,
  searchPlaceholder,
  drawerOpen,
  setDrawerOpen,
  projects,
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
  projectToDelete,
  setProjectToDelete,
  projectDeleting,
  handleDeleteProject,
  showDeletePerProject = false,
  onNewProjectClick,
  onAddClick,
  onCreateProject,
  onDeleteAllIssuesClick,
  deleteAllIssuesDisabled,
  children,
}: AppLayoutProps) {
  const router = useRouter();
  const {
    tabOrder,
    setTabOrder,
    hiddenTabIds,
    setHiddenTabIds,
    deletedTabIds,
    setDeletedTabIds,
  } = useTabOrder();
  const isMobile = useIsMobile();
  const drawerSettingsRef = React.useRef<HTMLDivElement>(null);
  const [drawerSettingsOpen, setDrawerSettingsOpen] = React.useState(false);
  const [drawerFiltersOpen, setDrawerFiltersOpen] = React.useState(false);
  const [drawerVoicesOpen, setDrawerVoicesOpen] = React.useState(false);
  const [drawerDeleteSectionsOpen, setDrawerDeleteSectionsOpen] =
    React.useState(false);
  const [projectOrderIds, setProjectOrderIds] = React.useState<string[]>([]);
  const [creatingProject, setCreatingProject] = React.useState(false);
  const [creatingProjectName, setCreatingProjectName] = React.useState("");
  const [creatingSection, setCreatingSection] = React.useState(false);
  const [creatingSectionName, setCreatingSectionName] = React.useState("");
  const [currentUserEmail, setCurrentUserEmail] = React.useState<string | null>(
    null
  );
  const [openRouterModelOptions, setOpenRouterModelOptions] = React.useState<
    string[]
  >(INITIAL_OPENROUTER_MODEL_OPTIONS);
  const [selectedAiModel, setSelectedAiModel] = React.useState<string>(() => {
    const stored = getStoredOpenRouterModel();
    if (stored && INITIAL_OPENROUTER_MODEL_OPTIONS.includes(stored))
      return stored;
    return INITIAL_OPENROUTER_MODEL_OPTIONS[0] ?? "";
  });
  const [availableVoices, setAvailableVoices] = React.useState<
    Array<{ value: string; label: string }>
  >([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = React.useState<string>("");
  const creatingProjectInputRef = React.useRef<HTMLInputElement>(null);
  const creatingSectionInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setProjectOrderIds((prev) => {
      const base = prev.length > 0 ? prev : loadProjectOrderIds();
      return mergeProjectOrder(projects, base);
    });
  }, [projects]);

  React.useEffect(() => {
    if (projectOrderIds.length > 0) saveProjectOrderIds(projectOrderIds);
  }, [projectOrderIds]);

  const orderedProjects = React.useMemo(() => {
    if (projectOrderIds.length === 0) return projects;
    const map = new Map(projects.map((p) => [p.id, p]));
    return mergeProjectOrder(projects, projectOrderIds)
      .map((id) => map.get(id))
      .filter((p): p is { id: string; name: string } => Boolean(p));
  }, [projects, projectOrderIds]);

  const moveProject = React.useCallback(
    (projectId: string, direction: "up" | "down") => {
      const ids = orderedProjects.map((p) => p.id);
      const from = ids.indexOf(projectId);
      if (from === -1) return;
      const to = direction === "up" ? from - 1 : from + 1;
      if (to < 0 || to >= ids.length) return;
      const next = [...ids];
      [next[from], next[to]] = [next[to], next[from]];
      setProjectOrderIds(next);
    },
    [orderedProjects]
  );
  const orderedNavLinks = React.useMemo(() => {
    const byId = new Map(SECTION_LINKS.map((l) => [l.tabId, l]));
    const customById = new Map<
      string,
      ReturnType<typeof getCustomLists>[number]
    >(getCustomLists().map((l) => [getCustomListTabId(l.slug), l]));
    const ordered = tabOrder
      .map((id) => {
        const builtIn = byId.get(id);
        if (builtIn) return builtIn;
        const custom = customById.get(id);
        if (!custom) return null;
        return {
          href: `/list/${custom.slug}`,
          label: custom.name,
          tabId: id,
        };
      })
      .filter(
        (
          link
        ): link is { href?: string; label: string; tabId: ProjectNavTabId } =>
          Boolean(link)
      );
    const missing = SECTION_LINKS.filter(
      (link) => !ordered.some((item) => item.tabId === link.tabId)
    );
    return [...ordered, ...missing];
  }, [tabOrder]);

  const visibleOrderedNavLinks = React.useMemo(
    () =>
      orderedNavLinks
        .filter((link) => !hiddenTabIds.includes(link.tabId))
        .filter(
          (link) =>
            !(isMobile && link.tabId === "code")
        ),
    [hiddenTabIds, isMobile, orderedNavLinks]
  );
  const drawerOrderedNavLinks = React.useMemo(
    () =>
      orderedNavLinks.filter(
        (link) => !(isMobile && link.tabId === "code")
      ),
    [isMobile, orderedNavLinks]
  );
  const sortedFilterSections = React.useMemo(
    () =>
      [...orderedNavLinks]
        .map((section) => ({
          ...section,
          visible: !hiddenTabIds.includes(section.tabId),
        }))
        .sort((a, b) => {
          if (a.visible !== b.visible) return a.visible ? -1 : 1;
          return a.label.localeCompare(b.label, undefined, {
            sensitivity: "base",
          });
        }),
    [hiddenTabIds, orderedNavLinks]
  );
  const drawerSortedFilterSections = React.useMemo(
    () =>
      sortedFilterSections.filter(
        (s) => !(isMobile && s.tabId === "code")
      ),
    [isMobile, sortedFilterSections]
  );

  const moveNavTab = React.useCallback(
    (tabId: ProjectNavTabId, direction: "up" | "down") => {
      const navTabIds = visibleOrderedNavLinks.map((l) => l.tabId);
      const fromVisible = navTabIds.indexOf(tabId);
      if (fromVisible === -1) return;
      const toVisible = direction === "up" ? fromVisible - 1 : fromVisible + 1;
      if (toVisible < 0 || toVisible >= navTabIds.length) return;
      const swapId = navTabIds[toVisible];
      const from = tabOrder.indexOf(tabId);
      const to = tabOrder.indexOf(swapId);
      if (from === -1 || to === -1) return;
      const next = [...tabOrder];
      [next[from], next[to]] = [next[to], next[from]];
      setTabOrder(next);
    },
    [setTabOrder, tabOrder, visibleOrderedNavLinks]
  );

  const deleteSectionTab = React.useCallback(
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

  const submitNewProject = React.useCallback(async () => {
    const name = creatingProjectName.trim();
    if (!name) {
      setCreatingProject(false);
      setCreatingProjectName("");
      return;
    }
    const createProject =
      onCreateProject ??
      ((nextName: string) =>
        router.push(
          "/?createProject=1&projectName=" + encodeURIComponent(nextName)
        ));
    await Promise.resolve(createProject(name));
    setCreatingProject(false);
    setCreatingProjectName("");
  }, [creatingProjectName, onCreateProject, router]);

  const submitNewSection = React.useCallback(() => {
    const name = creatingSectionName.trim();
    if (!name) {
      setCreatingSection(false);
      setCreatingSectionName("");
      return;
    }
    const list = addCustomList(name);
    const id = getCustomListTabId(list.slug);
    if (!tabOrder.includes(id)) {
      setTabOrder([...tabOrder, id]);
    }
    setCreatingSection(false);
    setCreatingSectionName("");
    void router.push(`/list/${list.slug}`);
  }, [creatingSectionName, router, setTabOrder, tabOrder]);

  const handleAddProject = React.useCallback(() => {
    setCreatingProject(true);
    setCreatingProjectName("");
    setEditingProjectId(null);
  }, [setEditingProjectId]);

  const handleAddTab = React.useCallback(() => {
    setCreatingSection(true);
    setCreatingSectionName("");
  }, []);

  const closeDrawerOnMobile = React.useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches
    ) {
      setDrawerOpen(false);
    }
  }, [setDrawerOpen]);

  React.useEffect(() => {
    if (!drawerOpen) {
      setDrawerSettingsOpen(false);
      setDrawerFiltersOpen(false);
      setDrawerVoicesOpen(false);
      setDrawerDeleteSectionsOpen(false);
    }
  }, [drawerOpen]);

  React.useEffect(() => {
    if (
      !drawerSettingsOpen &&
      !drawerFiltersOpen &&
      !drawerVoicesOpen &&
      !drawerDeleteSectionsOpen
    )
      return;
    const onOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (drawerSettingsRef.current?.contains(target)) return;
      setDrawerSettingsOpen(false);
      setDrawerFiltersOpen(false);
      setDrawerVoicesOpen(false);
      setDrawerDeleteSectionsOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [
    drawerDeleteSectionsOpen,
    drawerFiltersOpen,
    drawerVoicesOpen,
    drawerSettingsOpen,
  ]);

  React.useEffect(() => {
    if (creatingProject) creatingProjectInputRef.current?.focus();
  }, [creatingProject]);

  React.useEffect(() => {
    if (creatingSection) creatingSectionInputRef.current?.focus();
  }, [creatingSection]);

  React.useEffect(() => {
    const syncFromAuth = () => {
      const email = getUserEmailFromToken();
      setCurrentUserEmail(email);
      setSelectedVoiceUri(getStoredAssistantVoiceUri() ?? "");
      const stored = getStoredOpenRouterModel();
      if (stored && openRouterModelOptions.includes(stored)) {
        setSelectedAiModel(stored);
        return;
      }
      setSelectedAiModel(openRouterModelOptions[0] ?? "");
    };

    syncFromAuth();
    window.addEventListener(AUTH_CHANGE_EVENT, syncFromAuth);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, syncFromAuth);
  }, [openRouterModelOptions]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const syncVoices = async () => {
      const browserVoices = synth
        .getVoices()
        .map((voice) => ({
          value: `browser:${voice.voiceURI}`,
          label: `${voice.name} (${voice.lang})`,
        }))
        .filter((voice, idx, arr) => {
          const voiceUri = voice.value.replace(/^browser:/, "");
          if (!voiceUri) return false;
          return arr.findIndex((v) => v.value === voice.value) === idx;
        })
        .sort((a, b) => a.label.localeCompare(b.label));

      let elevenLabsVoices: Array<{ value: string; label: string }> = [];
      try {
        const voices = await fetchElevenLabsVoices();
        elevenLabsVoices = voices.map((voice) => ({
          value: `elevenlabs:${voice.id}`,
          label: `11Labs: ${voice.name}`,
        }));
      } catch {
        // keep browser voices only when ElevenLabs is unavailable
      }

      const voices = [...elevenLabsVoices, ...browserVoices];
      setAvailableVoices(voices);
      const stored = getStoredAssistantVoiceUri();
      const normalizedStored =
        stored && !stored.includes(":") ? `browser:${stored}` : stored;
      if (
        normalizedStored &&
        voices.some((voice) => voice.value === normalizedStored)
      ) {
        setSelectedVoiceUri(normalizedStored);
        if (stored !== normalizedStored)
          setStoredAssistantVoiceUri(normalizedStored);
      } else if (voices[0]) {
        setSelectedVoiceUri(voices[0].value);
      } else {
        setSelectedVoiceUri("");
      }
    };
    void syncVoices();
    const onVoicesChanged = () => {
      void syncVoices();
    };
    synth.addEventListener("voiceschanged", onVoicesChanged);
    window.addEventListener(ASSISTANT_VOICE_CHANGE_EVENT, onVoicesChanged);
    return () => {
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      window.removeEventListener(ASSISTANT_VOICE_CHANGE_EVENT, onVoicesChanged);
    };
  }, []);

  const canManageOpenRouterModel = React.useMemo(() => {
    const email = currentUserEmail?.toLowerCase().trim();
    if (!email) return false;
    if (openRouterModelOptions.length === 0) return false;
    return OPENROUTER_MODEL_SWITCHER_EMAILS.has(email);
  }, [currentUserEmail, openRouterModelOptions]);

  const selectedVoiceLabel = React.useMemo(
    () =>
      availableVoices.find((voice) => voice.value === selectedVoiceUri)?.label ??
      "Assistant voice",
    [availableVoices, selectedVoiceUri]
  );

  React.useEffect(() => {
    if (!canManageOpenRouterModel) return;
    let active = true;
    (async () => {
      try {
        const models = await fetchOpenRouterModels();
        if (!active || models.length === 0) return;
        setOpenRouterModelOptions((prev) => {
          const merged = Array.from(new Set([...models, ...prev]));
          return merged;
        });
      } catch {
        // Keep env/default list when live fetch fails.
      }
    })();
    return () => {
      active = false;
    };
  }, [canManageOpenRouterModel]);

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}
      <div className={`app-layout${drawerOpen ? " is-drawer-open" : ""}`}>
        <AppDrawer
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
          activeTab={activeTab}
          orderedProjects={orderedProjects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          editingProjectId={editingProjectId}
          setEditingProjectId={setEditingProjectId}
          editingProjectName={editingProjectName}
          setEditingProjectName={setEditingProjectName}
          saveProjectName={saveProjectName}
          cancelEditProjectName={cancelEditProjectName}
          projectNameInputRef={projectNameInputRef}
          theme={theme}
          toggleTheme={toggleTheme}
          showDeletePerProject={showDeletePerProject}
          handleDeleteProject={handleDeleteProject}
          projectDeleting={projectDeleting}
          moveProject={moveProject}
          visibleOrderedNavLinks={visibleOrderedNavLinks}
          moveNavTab={moveNavTab}
          onAddProject={handleAddProject}
          onAddTab={handleAddTab}
          closeDrawerOnMobile={closeDrawerOnMobile}
          creatingProject={creatingProject}
          creatingProjectName={creatingProjectName}
          setCreatingProjectName={setCreatingProjectName}
          creatingProjectInputRef={creatingProjectInputRef}
          submitNewProject={submitNewProject}
          onCancelCreatingProject={() => {
            setCreatingProject(false);
            setCreatingProjectName("");
          }}
          creatingSection={creatingSection}
          creatingSectionName={creatingSectionName}
          setCreatingSectionName={setCreatingSectionName}
          creatingSectionInputRef={creatingSectionInputRef}
          submitNewSection={submitNewSection}
          onCancelCreatingSection={() => {
            setCreatingSection(false);
            setCreatingSectionName("");
          }}
          drawerSettingsRef={drawerSettingsRef}
          drawerSettingsOpen={drawerSettingsOpen}
          setDrawerSettingsOpen={setDrawerSettingsOpen}
          drawerFiltersOpen={drawerFiltersOpen}
          setDrawerFiltersOpen={setDrawerFiltersOpen}
          drawerVoicesOpen={drawerVoicesOpen}
          setDrawerVoicesOpen={setDrawerVoicesOpen}
          drawerDeleteSectionsOpen={drawerDeleteSectionsOpen}
          setDrawerDeleteSectionsOpen={setDrawerDeleteSectionsOpen}
          sortedFilterSections={drawerSortedFilterSections}
          hiddenTabIds={hiddenTabIds}
          setHiddenTabIds={setHiddenTabIds}
          availableVoices={availableVoices}
          selectedVoiceUri={selectedVoiceUri}
          setSelectedVoiceUri={setSelectedVoiceUri}
          selectedVoiceLabel={selectedVoiceLabel}
          openRouterModelOptions={openRouterModelOptions}
          selectedAiModel={selectedAiModel}
          setSelectedAiModel={setSelectedAiModel}
          canManageOpenRouterModel={canManageOpenRouterModel}
          orderedNavLinks={drawerOrderedNavLinks}
          tabOrderLength={tabOrder.length}
          deleteSectionTab={deleteSectionTab}
        />

        <main className="main-content">
          <ProjectNavBar
            projectName={projectName}
            projectId={projectId}
            activeTab={activeTab}
            searchPlaceholder={searchPlaceholder}
            onAddClick={onAddClick}
            onOpenDrawer={() => setDrawerOpen((o) => !o)}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              closeDrawerOnMobile();
            }}
            onCreateProject={
              onCreateProject ??
              ((name) => {
                void router.push(
                  "/?createProject=1&projectName=" + encodeURIComponent(name)
                );
              })
            }
            onDeleteProjectClick={() => {
              const current = projects.find((p) => p.id === selectedProjectId);
              if (current) void handleDeleteProject(current);
            }}
            onDeleteAllIssuesClick={onDeleteAllIssuesClick}
            deleteAllIssuesDisabled={deleteAllIssuesDisabled}
          />

          {children}
        </main>
      </div>
      <BulbyChatbox
        projectId={
          selectedProjectId ||
          orderedProjects[0]?.id ||
          ""
        }
      />
    </>
  );
}
