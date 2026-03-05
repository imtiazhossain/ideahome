import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  APPEARANCE_PRESETS,
  fetchMyAppearancePrefs,
  getUserScopedStorageKey,
  isAuthenticated,
  updateMyAppearancePrefs,
  type AppearancePresetId,
} from "./api";
import { AUTH_CHANGE_EVENT } from "./api/auth";
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
} from "./storage";

export type Theme = "light" | "dark";
export type ThemeSaveState = "idle" | "saving" | "success" | "error";

export type ThemePresetSelection = {
  lightPreset: AppearancePresetId;
  darkPreset: AppearancePresetId;
};

const DEFAULT_PRESETS: ThemePresetSelection = {
  lightPreset: "classic",
  darkPreset: "classic",
};

const APPEARANCE_CACHE_PREFIX = "ideahome-appearance-prefs";
const APPEARANCE_CACHE_LEGACY_KEY = "ideahome-appearance-prefs";
const APPEARANCE_PENDING_PREFIX = "ideahome-appearance-prefs-pending";
const APPEARANCE_PENDING_LEGACY_KEY = "ideahome-appearance-prefs-pending";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  appliedPresets: ThemePresetSelection;
  draftPresets: ThemePresetSelection;
  setDraftPreset: (theme: Theme, preset: AppearancePresetId) => void;
  resetDraftPresets: () => void;
  saveAppearancePrefs: () => Promise<void>;
  saveState: ThemeSaveState;
  saveError: string | null;
} | null>(null);

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = safeLocalStorageGet("theme");
  if (stored === "dark" || stored === "light") return stored;
  return "dark";
}

function getAppearanceCacheStorageKey(): string {
  return getUserScopedStorageKey(
    APPEARANCE_CACHE_PREFIX,
    APPEARANCE_CACHE_LEGACY_KEY
  );
}

function getAppearancePendingStorageKey(): string {
  return getUserScopedStorageKey(
    APPEARANCE_PENDING_PREFIX,
    APPEARANCE_PENDING_LEGACY_KEY
  );
}

function isPresetId(value: unknown): value is AppearancePresetId {
  return (
    typeof value === "string" &&
    (APPEARANCE_PRESETS as readonly string[]).includes(value)
  );
}

function parsePresetSelection(raw: unknown): ThemePresetSelection | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (!isPresetId(value.lightPreset) || !isPresetId(value.darkPreset)) {
    return null;
  }
  return {
    lightPreset: value.lightPreset,
    darkPreset: value.darkPreset,
  };
}

function readStoredPresetSelection(key: string): ThemePresetSelection | null {
  if (typeof window === "undefined") return null;
  const raw = safeLocalStorageGet(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsePresetSelection(parsed);
  } catch {
    return null;
  }
}

function writeStoredPresetSelection(key: string, value: ThemePresetSelection) {
  safeLocalStorageSet(key, JSON.stringify(value));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [appliedPresets, setAppliedPresets] =
    useState<ThemePresetSelection>(DEFAULT_PRESETS);
  const [draftPresets, setDraftPresets] =
    useState<ThemePresetSelection>(DEFAULT_PRESETS);
  const [saveState, setSaveState] = useState<ThemeSaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const syncPendingAppearancePrefs = useCallback(async () => {
    if (!isAuthenticated()) return;
    const pending = readStoredPresetSelection(getAppearancePendingStorageKey());
    if (!pending) return;
    try {
      const saved = await updateMyAppearancePrefs(pending);
      const normalized =
        parsePresetSelection(saved) ?? {
          ...pending,
        };
      setAppliedPresets(normalized);
      writeStoredPresetSelection(getAppearanceCacheStorageKey(), normalized);
      safeLocalStorageRemove(getAppearancePendingStorageKey());
      setSaveError(null);
      setSaveState((prev) => (prev === "saving" ? "success" : prev));
    } catch {
      // Keep pending value and retry on next trigger.
    }
  }, []);

  const loadAppearancePrefs = useCallback(async () => {
    const pending = readStoredPresetSelection(getAppearancePendingStorageKey());
    const cached = readStoredPresetSelection(getAppearanceCacheStorageKey());
    if (pending) {
      setAppliedPresets(pending);
      setDraftPresets(pending);
    } else if (cached) {
      setAppliedPresets(cached);
      setDraftPresets(cached);
    }
    if (!isAuthenticated()) return;
    try {
      const prefs = await fetchMyAppearancePrefs();
      const normalized = parsePresetSelection(prefs) ?? DEFAULT_PRESETS;
      const hasPending = Boolean(
        readStoredPresetSelection(getAppearancePendingStorageKey())
      );
      if (!hasPending) {
        setAppliedPresets(normalized);
        setDraftPresets(normalized);
        writeStoredPresetSelection(getAppearanceCacheStorageKey(), normalized);
      }
      setSaveError(null);
    } catch {
      // Keep cached settings on network/API failure.
    }
  }, []);

  useEffect(() => {
    setTheme(getStoredTheme());
    const cached = readStoredPresetSelection(getAppearanceCacheStorageKey());
    if (cached) {
      setAppliedPresets(cached);
      setDraftPresets(cached);
    }
    void loadAppearancePrefs();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    safeLocalStorageSet("theme", theme);
  }, [theme]);

  const activeColorScheme =
    theme === "light" ? draftPresets.lightPreset : draftPresets.darkPreset;

  useEffect(() => {
    document.documentElement.setAttribute("data-color-scheme", activeColorScheme);
  }, [activeColorScheme]);

  useEffect(() => {
    const onAuthChange = () => {
      void loadAppearancePrefs();
      void syncPendingAppearancePrefs();
    };
    const onOnline = () => {
      void syncPendingAppearancePrefs();
    };
    window.addEventListener(AUTH_CHANGE_EVENT, onAuthChange);
    window.addEventListener("online", onOnline);
    void syncPendingAppearancePrefs();
    const interval = window.setInterval(() => {
      void syncPendingAppearancePrefs();
    }, 15000);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, onAuthChange);
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
    };
  }, [loadAppearancePrefs, syncPendingAppearancePrefs]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const setDraftPreset = useCallback((targetTheme: Theme, preset: AppearancePresetId) => {
    setDraftPresets((prev) => ({
      ...prev,
      ...(targetTheme === "light"
        ? { lightPreset: preset }
        : { darkPreset: preset }),
    }));
  }, []);

  const resetDraftPresets = useCallback(() => {
    setDraftPresets(appliedPresets);
    setSaveState("idle");
    setSaveError(null);
  }, [appliedPresets]);

  const saveAppearancePrefs = useCallback(async () => {
    const next = draftPresets;
    setSaveState("saving");
    setSaveError(null);
    setAppliedPresets(next);
    writeStoredPresetSelection(getAppearanceCacheStorageKey(), next);
    if (!isAuthenticated()) {
      safeLocalStorageRemove(getAppearancePendingStorageKey());
      setSaveState("success");
      return;
    }
    try {
      const saved = await updateMyAppearancePrefs(next);
      const normalized = parsePresetSelection(saved) ?? next;
      setAppliedPresets(normalized);
      setDraftPresets(normalized);
      writeStoredPresetSelection(getAppearanceCacheStorageKey(), normalized);
      safeLocalStorageRemove(getAppearancePendingStorageKey());
      setSaveState("success");
    } catch {
      writeStoredPresetSelection(getAppearancePendingStorageKey(), next);
      setSaveError("Saved locally. Sync will retry automatically.");
      setSaveState("error");
      void syncPendingAppearancePrefs();
    }
  }, [draftPresets, syncPendingAppearancePrefs]);

  const value = useMemo(
    () => ({
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
    }),
    [
      appliedPresets,
      draftPresets,
      resetDraftPresets,
      saveAppearancePrefs,
      saveError,
      saveState,
      setDraftPreset,
      theme,
      toggleTheme,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
