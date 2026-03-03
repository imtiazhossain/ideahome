import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  createGithubRepositoryForProject,
  fetchProjectCodeRepositories,
  type ProjectCodeRepository,
} from "./api";
import {
  buildStaffRatingPrompt,
  buildTokenAuditPrompt,
  buildWireframe,
  computeAuditRating,
  deriveCodeRating,
  describeRating,
  readJsonIfAvailable,
  STAFF_CODE_RATING,
  type AuditPayload,
  type WireframeSnapshot,
} from "./codePageUtils";

export const CODE_PAGE_SECTION_IDS = [
  "code-repos",
  "code-audit",
  "code-security",
  "code-rating",
  "code-health",
  "code-wireframe",
  "code-project-flow",
] as const;

export type CodePageState = {
  running: boolean;
  payload: AuditPayload | null;
  requestError: string | null;
  wireframe: WireframeSnapshot | null;
  codeRating: number;
  setCodeRating: (n: number) => void;
  auditRating: number | null;
  repos: ProjectCodeRepository[];
  reposLoading: boolean;
  reposError: string | null;
  connectRepoName: string;
  setConnectRepoName: (s: string) => void;
  connectRepoBranch: string;
  setConnectRepoBranch: (s: string) => void;
  connectSubmitting: boolean;
  promptCopied: boolean;
  questionCopied: boolean;
  auditPromptCopied: boolean;
  sectionCollapsed: Record<string, boolean>;
  toggleSection: (sectionId: string) => void;
  isSectionCollapsed: (sectionId: string) => boolean;
  sectionOrder: string[];
  setSectionOrder: (order: string[]) => void;
  runAudit: () => Promise<void>;
  generateWireframe: () => void;
  handleCopyPrompt: () => Promise<void>;
  handleCopyQuestion: () => Promise<void>;
  handleCopyAuditPrompt: () => Promise<void>;
  handleConnectRepo: () => Promise<void>;
  ratingQuestion: string;
  setRatingQuestion: (s: string) => void;
  codeRatingLabel: string;
  auditRatingLabel: string | null;
  staffPromptText: string;
  setStaffPromptText: (s: string) => void;
  auditPromptText: string;
};

export function useCodePageState(
  selectedProjectId: string | null
): CodePageState {
  const [running, setRunning] = useState(false);
  const [payload, setPayload] = useState<AuditPayload | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [wireframe, setWireframe] = useState<WireframeSnapshot | null>(null);
  const [codeRating, setCodeRating] = useState<number>(STAFF_CODE_RATING);
  const [auditRating, setAuditRating] = useState<number | null>(null);
  const [repos, setRepos] = useState<ProjectCodeRepository[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [connectRepoName, setConnectRepoName] = useState("");
  const [connectRepoBranch, setConnectRepoBranch] = useState("");
  const [connectSubmitting, setConnectSubmitting] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [questionCopied, setQuestionCopied] = useState(false);
  const [auditPromptCopied, setAuditPromptCopied] = useState(false);
  const [sectionCollapsed, setSectionCollapsed] = useState<
    Record<string, boolean>
  >({ "code-project-flow": false }); // project flow diagram starts expanded

  const sectionOrderStorageKey = `ideahome-code-section-order${selectedProjectId ? `-${selectedProjectId}` : ""}`;
  const [sectionOrder, setSectionOrderState] = useState<string[]>([
    ...CODE_PAGE_SECTION_IDS,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        sectionOrderStorageKey,
        JSON.stringify(sectionOrder)
      );
    } catch {
      /* ignore */
    }
  }, [sectionOrder, sectionOrderStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `ideahome-code-section-order${selectedProjectId ? `-${selectedProjectId}` : ""}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const valid = CODE_PAGE_SECTION_IDS as unknown as string[];
      const ordered = (parsed as string[]).filter((id) => valid.includes(id));
      const missing = valid.filter((id) => !ordered.includes(id));
      setSectionOrderState(
        ordered.length ? [...ordered, ...missing] : [...CODE_PAGE_SECTION_IDS]
      );
    } catch {
      /* ignore */
    }
  }, [selectedProjectId]);

  const setSectionOrder = useCallback((order: string[]) => {
    setSectionOrderState(order);
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setRepos([]);
      setReposError(null);
      return;
    }
    let cancelled = false;
    setReposLoading(true);
    setReposError(null);
    fetchProjectCodeRepositories(selectedProjectId)
      .then((data) => {
        if (cancelled) return;
        setRepos(data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setReposError(
          error instanceof Error ? error.message : "Failed to load repositories"
        );
      })
      .finally(() => {
        if (cancelled) return;
        setReposLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const runAudit = useCallback(async () => {
    setRunning(true);
    setRequestError(null);
    setPayload(null);
    try {
      const response = await fetch(`/api/run-token-audit?ts=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
        },
      });
      const { data, text } = await readJsonIfAvailable<AuditPayload>(response);
      if (!data) {
        setPayload(null);
        const detail = text
          ? text
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 180)
          : "";
        setRequestError(
          `Audit request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
        );
        return;
      }
      setPayload(data);
      setWireframe(buildWireframe(data));
      const nextAuditRating = computeAuditRating(data);
      setAuditRating(nextAuditRating);
      setCodeRating(deriveCodeRating(STAFF_CODE_RATING, nextAuditRating));
      if (!response.ok || data.ok !== true) {
        setRequestError(data.error ?? `Audit failed (${response.status})`);
      }
    } catch (error) {
      setPayload(null);
      setRequestError(
        error instanceof Error ? error.message : "Failed to run token audit"
      );
    } finally {
      setRunning(false);
    }
  }, []);

  const generateWireframe = useCallback(() => {
    setWireframe(buildWireframe(payload));
  }, [payload]);

  const codeRatingStorageKey = (prefix: string) =>
    `ideahome-code-${prefix}${selectedProjectId ? `-${selectedProjectId}` : ""}`;

  const [ratingQuestion, setRatingQuestion] = useState(
    "How would you rate the current codebase?"
  );
  const [staffPromptText, setStaffPromptText] = useState(
    buildStaffRatingPrompt(STAFF_CODE_RATING)
  );

  // Load persisted values when switching project
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qKey = codeRatingStorageKey("rating-question");
    const pKey = codeRatingStorageKey("staff-prompt");
    const savedQ = localStorage.getItem(qKey);
    const savedP = localStorage.getItem(pKey);
    setRatingQuestion(savedQ ?? "How would you rate the current codebase?");
    setStaffPromptText(savedP ?? buildStaffRatingPrompt(STAFF_CODE_RATING));
  }, [selectedProjectId]);

  // Persist edits so code-block and other changes save (key uses current selectedProjectId)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qKey = codeRatingStorageKey("rating-question");
    const pKey = codeRatingStorageKey("staff-prompt");
    localStorage.setItem(qKey, ratingQuestion);
    localStorage.setItem(pKey, staffPromptText);
  }, [ratingQuestion, staffPromptText]);

  const auditPromptText = useMemo(
    () => buildTokenAuditPrompt(auditRating),
    [auditRating]
  );

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(staffPromptText);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1800);
    } catch {
      setPromptCopied(false);
    }
  }, [staffPromptText]);

  const handleCopyAuditPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(auditPromptText);
      setAuditPromptCopied(true);
      window.setTimeout(() => setAuditPromptCopied(false), 1800);
    } catch {
      setAuditPromptCopied(false);
    }
  }, [auditPromptText]);

  const handleCopyQuestion = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ratingQuestion);
      setQuestionCopied(true);
      window.setTimeout(() => setQuestionCopied(false), 1800);
    } catch {
      setQuestionCopied(false);
    }
  }, [ratingQuestion]);

  const handleConnectRepo = useCallback(async () => {
    if (!selectedProjectId || !connectRepoName.trim()) return;
    setConnectSubmitting(true);
    try {
      const repo = await createGithubRepositoryForProject(selectedProjectId, {
        repoFullName: connectRepoName.trim(),
        defaultBranch: connectRepoBranch.trim() || undefined,
      });
      setRepos((prev) => [...prev, repo]);
      setConnectRepoName("");
      setConnectRepoBranch("");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      setConnectSubmitting(false);
    }
  }, [selectedProjectId, connectRepoName, connectRepoBranch]);

  const toggleSection = useCallback((sectionId: string) => {
    setSectionCollapsed((prev) => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? false),
    }));
  }, []);

  const isSectionCollapsed = useCallback(
    (sectionId: string) => sectionCollapsed[sectionId] ?? false,
    [sectionCollapsed]
  );

  const codeRatingLabel = useMemo(
    () => describeRating(codeRating),
    [codeRating]
  );
  const auditRatingLabel = useMemo(
    () => (auditRating == null ? null : describeRating(auditRating)),
    [auditRating]
  );

  return {
    running,
    payload,
    requestError,
    wireframe,
    codeRating,
    setCodeRating,
    auditRating,
    repos,
    reposLoading,
    reposError,
    connectRepoName,
    setConnectRepoName,
    connectRepoBranch,
    setConnectRepoBranch,
    connectSubmitting,
    promptCopied,
    questionCopied,
    auditPromptCopied,
    sectionCollapsed,
    toggleSection,
    isSectionCollapsed,
    sectionOrder,
    setSectionOrder,
    runAudit,
    generateWireframe,
    handleCopyPrompt,
    handleCopyQuestion,
    handleCopyAuditPrompt,
    handleConnectRepo,
    ratingQuestion,
    setRatingQuestion,
    codeRatingLabel,
    auditRatingLabel,
    staffPromptText,
    setStaffPromptText,
    auditPromptText,
  };
}
