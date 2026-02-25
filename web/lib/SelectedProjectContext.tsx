import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getUserScopedStorageKey } from "./api";

function getSelectedProjectStorageKey(): string {
  return getUserScopedStorageKey(
    "ideahome-selected-project-id",
    "ideahome-selected-project-id"
  );
}

function getStoredSelectedProjectId(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = localStorage.getItem(getSelectedProjectStorageKey());
    return stored && stored.length > 0 ? stored : "";
  } catch {
    return "";
  }
}

function setStoredSelectedProjectId(id: string) {
  try {
    const key = getSelectedProjectStorageKey();
    if (id) {
      localStorage.setItem(key, id);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

const SelectedProjectContext = createContext<{
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  lastKnownProjectName: string;
  setLastKnownProjectName: (name: string) => void;
} | null>(null);

export function SelectedProjectProvider({ children }: { children: React.ReactNode }) {
  const [selectedProjectId, setSelectedProjectIdState] = useState<string>("");
  const [lastKnownProjectName, setLastKnownProjectName] = useState<string>("");

  useEffect(() => {
    setSelectedProjectIdState(getStoredSelectedProjectId());
  }, []);

  const setSelectedProjectId = useCallback((id: string) => {
    setSelectedProjectIdState((prev) => {
      if (prev !== id) setLastKnownProjectName("");
      return id;
    });
    setStoredSelectedProjectId(id);
  }, [setLastKnownProjectName]);

  return (
    <SelectedProjectContext.Provider
      value={{
        selectedProjectId,
        setSelectedProjectId,
        lastKnownProjectName,
        setLastKnownProjectName,
      }}
    >
      {children}
    </SelectedProjectContext.Provider>
  );
}

export function useSelectedProject() {
  const ctx = useContext(SelectedProjectContext);
  if (!ctx) throw new Error("useSelectedProject must be used within SelectedProjectProvider");
  return ctx;
}
