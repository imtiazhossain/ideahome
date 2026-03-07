import React, { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { AppLayout } from "../components/AppLayout";
import { AutoResizeTextarea } from "../components/AutoResizeTextarea";
import { CodeHealthSection } from "../components/CodeHealthSection";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { IconGrip } from "../components/IconGrip";
import { ProjectFlowDiagram } from "../components/ProjectFlowDiagram";
import { TokenUsageGraph } from "../components/TokenUsageGraph";
import {
  buildCodeRatingSuggestions,
  readJsonIfAvailable,
  severityLabel,
  type AuditPayload,
  type AuditFinding,
  type WireframeSnapshot,
} from "../lib/codePageUtils";
import { API_REQUEST_HEADER } from "../lib/api";
import { APP_RELEASE_NOTES } from "../lib/releaseNotes";
import { useCodePageState } from "../lib/useCodePageState";
import { useProjectLayout } from "../lib/useProjectLayout";
import { useTheme } from "./_app";

type SecuritySeverity = "critical" | "high" | "moderate" | "low";

type SecurityAuditSummary = {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  totalDependencies: number;
};

type SecurityAuditFinding = {
  id: string;
  moduleName: string;
  title: string;
  severity: SecuritySeverity;
  recommendation: string;
  url: string | null;
};

type SecurityAuditResponse = {
  ok: boolean;
  generatedAt: string;
  durationMs: number;
  score: number | null;
  summary: SecurityAuditSummary;
  findings: SecurityAuditFinding[];
  error?: string;
};

function formatTokenFindingsForClipboard(findings: AuditFinding[]): string {
  return findings
    .map((finding, index) => {
      const location = [
        finding.file ? `File: ${finding.file}` : "",
        finding.lines != null ? `${finding.lines} lines` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      return [
        `${index + 1}. ${finding.title}`,
        `Severity: ${severityLabel(finding.severity)}`,
        `Effort: ${finding.effort}`,
        `Why: ${finding.why}`,
        `Action: ${finding.action}`,
        location,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function formatSecurityFindingsForClipboard(
  findings: SecurityAuditFinding[]
): string {
  return findings
    .map((finding, index) =>
      [
        `${index + 1}. ${finding.title}`,
        `Package: ${finding.moduleName}`,
        `Severity: ${finding.severity}`,
        `Recommendation: ${finding.recommendation}`,
        finding.url ? `Advisory: ${finding.url}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function formatReleaseDate(date: string): string {
  const parts = date.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year && month && day) return `${month}-${day}-${year}`;
  }
  return date;
}

function SortableCodeSection({
  sectionId,
  children,
}: {
  sectionId: string;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({ id: sectionId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const dragHandle = (
    <span
      className="code-page-section-drag-handle features-list-drag-handle"
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      title="Drag to reorder"
    >
      <IconGrip />
    </span>
  );
  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandle)}
    </div>
  );
}

export default function CodePage() {
  const layout = useProjectLayout();
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    projectDisplayName,
    drawerOpen,
    setDrawerOpen,
    editingProjectId,
    setEditingProjectId,
    editingProjectName,
    setEditingProjectName,
    projectNameInputRef,
    saveProjectName,
    cancelEditProjectName,
    projectToDelete,
    setProjectToDelete,
    projectDeleting,
    handleDeleteProject,
  } = layout;
  const { theme, toggleTheme } = useTheme();
  const codeState = useCodePageState(selectedProjectId);
  const {
    running,
    payload,
    requestError,
    wireframe,
    codeRating,
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
  } = codeState;

  const hasSelectedProject = Boolean(selectedProjectId);
  const findings = payload?.findings ?? [];
  const generatedAt = useMemo(() => {
    if (!payload?.generatedAt) return null;
    return new Date(payload.generatedAt).toLocaleString();
  }, [payload?.generatedAt]);
  const [securityAuditRunning, setSecurityAuditRunning] = useState(false);
  const [securityAuditError, setSecurityAuditError] = useState<string | null>(
    null
  );
  const [securityAuditScore, setSecurityAuditScore] = useState<number | null>(
    null
  );
  const [securityAuditSummary, setSecurityAuditSummary] =
    useState<SecurityAuditSummary | null>(null);
  const [securityAuditFindings, setSecurityAuditFindings] = useState<
    SecurityAuditFinding[]
  >([]);
  const [securityAuditGeneratedAt, setSecurityAuditGeneratedAt] = useState<
    string | null
  >(null);
  const [tokenFindingsCopied, setTokenFindingsCopied] = useState(false);
  const [securityFindingsCopied, setSecurityFindingsCopied] = useState(false);
  const [projectFlowRefreshNonce, setProjectFlowRefreshNonce] = useState(0);
  const runSecurityAudit = useCallback(async () => {
    setSecurityAuditRunning(true);
    setSecurityAuditError(null);
    try {
      const response = await fetch(`/api/run-security-audit?ts=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          [API_REQUEST_HEADER]: "1",
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
        },
      });
      const { data, text } = await readJsonIfAvailable<SecurityAuditResponse>(
        response
      );
      if (!data) {
        setSecurityAuditScore(null);
        setSecurityAuditSummary(null);
        setSecurityAuditFindings([]);
        setSecurityAuditGeneratedAt(null);
        const detail = text
          ? text
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 180)
          : "";
        setSecurityAuditError(
          `Security audit request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
        );
        return;
      }
      setSecurityAuditScore(data.score);
      setSecurityAuditSummary(data.summary);
      setSecurityAuditFindings(data.findings ?? []);
      setSecurityAuditGeneratedAt(data.generatedAt ?? null);
      if (!response.ok) {
        setSecurityAuditError(
          data.error ?? `Security audit failed (${response.status})`
        );
      } else if (data.ok !== true && data.error) {
        setSecurityAuditError(data.error);
      }
    } catch (error) {
      setSecurityAuditScore(null);
      setSecurityAuditSummary(null);
      setSecurityAuditFindings([]);
      setSecurityAuditGeneratedAt(null);
      setSecurityAuditError(
        error instanceof Error ? error.message : "Failed to run security audit"
      );
    } finally {
      setSecurityAuditRunning(false);
    }
  }, []);
  const updateProjectFlowDiagram = useCallback(() => {
    setProjectFlowRefreshNonce((prev) => prev + 1);
  }, []);
  const handleSecurityAuditClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (securityAuditRunning) return;
      void runSecurityAudit();
    },
    [runSecurityAudit, securityAuditRunning]
  );
  const handleCopyTokenFindings = useCallback(async () => {
    if (findings.length === 0) return;
    try {
      await navigator.clipboard.writeText(
        formatTokenFindingsForClipboard(findings)
      );
      setTokenFindingsCopied(true);
      window.setTimeout(() => setTokenFindingsCopied(false), 1800);
    } catch {
      setTokenFindingsCopied(false);
    }
  }, [findings]);
  const handleCopySecurityFindings = useCallback(async () => {
    if (securityAuditFindings.length === 0) return;
    try {
      await navigator.clipboard.writeText(
        formatSecurityFindingsForClipboard(securityAuditFindings)
      );
      setSecurityFindingsCopied(true);
      window.setTimeout(() => setSecurityFindingsCopied(false), 1800);
    } catch {
      setSecurityFindingsCopied(false);
    }
  }, [securityAuditFindings]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleSectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sectionOrder.indexOf(String(active.id));
      const newIndex = sectionOrder.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      const next = [...sectionOrder];
      const [removed] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, removed);
      setSectionOrder(next);
    },
    [sectionOrder, setSectionOrder]
  );

  const renderCodeSection = useCallback(
    (sectionId: string, dragHandle: React.ReactNode) =>
      renderCodeSectionInner(sectionId, dragHandle, {
        hasSelectedProject,
        connectRepoName,
        setConnectRepoName,
        connectRepoBranch,
        setConnectRepoBranch,
        connectSubmitting,
        selectedProjectId,
        handleConnectRepo,
        reposError,
        reposLoading,
        repos,
        isSectionCollapsed,
        toggleSection,
        running,
        runAudit,
        auditRating,
        auditRatingLabel,
        handleCopyAuditPrompt,
        auditPromptCopied,
        auditPromptText,
        payload,
        findings,
        requestError,
        codeRating,
        codeRatingLabel,
        ratingQuestion,
        setRatingQuestion,
        questionCopied,
        handleCopyQuestion,
        staffPromptText,
        setStaffPromptText,
        promptCopied,
        handleCopyPrompt,
        wireframe,
        generateWireframe,
        projectFlowRefreshNonce,
        updateProjectFlowDiagram,
        securityAuditRunning,
        securityAuditError,
        securityAuditSummary,
        securityAuditFindings,
        securityAuditGeneratedAt,
        securityAuditScore,
        handleSecurityAuditClick,
        tokenFindingsCopied,
        securityFindingsCopied,
        handleCopyTokenFindings,
        handleCopySecurityFindings,
      }),
    [
      hasSelectedProject,
      connectRepoName,
      connectRepoBranch,
      connectSubmitting,
      selectedProjectId,
      handleConnectRepo,
      reposError,
      reposLoading,
      repos,
      isSectionCollapsed,
      toggleSection,
      running,
      runAudit,
      auditRating,
      auditRatingLabel,
      handleCopyAuditPrompt,
      auditPromptCopied,
      auditPromptText,
      payload,
      findings,
      requestError,
      codeRating,
      codeRatingLabel,
      ratingQuestion,
      setRatingQuestion,
      questionCopied,
      handleCopyQuestion,
      staffPromptText,
      setStaffPromptText,
      promptCopied,
      handleCopyPrompt,
      wireframe,
      generateWireframe,
      projectFlowRefreshNonce,
      updateProjectFlowDiagram,
      securityAuditRunning,
      securityAuditError,
      securityAuditSummary,
      securityAuditFindings,
      securityAuditGeneratedAt,
      securityAuditScore,
      handleSecurityAuditClick,
      tokenFindingsCopied,
      securityFindingsCopied,
      handleCopyTokenFindings,
      handleCopySecurityFindings,
    ]
  );

  return (
    <AppLayout
      title="Code · Idea Home"
      activeTab="code"
      projectName={projectDisplayName}
      projectId={selectedProjectId || undefined}
      searchPlaceholder="Search project"
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      projects={projects}
      selectedProjectId={selectedProjectId ?? ""}
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
      projectToDelete={projectToDelete}
      setProjectToDelete={setProjectToDelete}
      projectDeleting={projectDeleting}
      handleDeleteProject={handleDeleteProject}
      onCreateProject={layout.createProjectByName}
      onRenameProject={layout.renameProjectById}
    >
      <div className="code-page-content">
        <div className="code-page">
          <header className="code-page-header">
            <h1 className="code-page-title">Code</h1>
            <p className="code-page-subtitle">
              Connect a GitHub repo per project and run a token-efficiency audit
              with prioritized refactor guidance.
            </p>
          </header>

          <DndContext
            id="code-page-sections-dnd"
            sensors={sensors}
            modifiers={[restrictToWindowEdges]}
            collisionDetection={closestCenter}
            onDragEnd={handleSectionDragEnd}
          >
            <SortableContext
              items={sectionOrder}
              strategy={verticalListSortingStrategy}
            >
              {sectionOrder.map((sectionId) => (
                <SortableCodeSection key={sectionId} sectionId={sectionId}>
                  {(dragHandle) => renderCodeSection(sectionId, dragHandle)}
                </SortableCodeSection>
              ))}
            </SortableContext>
          </DndContext>

          {requestError && (
            <section className="code-page-error" aria-live="polite">
              {requestError}
            </section>
          )}

          {generatedAt && (
            <p className="code-page-generated-at">
              Last audit: {generatedAt}
              {payload?.durationMs != null ? ` · ${payload.durationMs} ms` : ""}
              {payload?.runId ? ` · run ${payload.runId}` : ""}
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function renderCodeSectionInner(
  sectionId: string,
  dragHandle: React.ReactNode,
  ctx: {
    hasSelectedProject: boolean;
    connectRepoName: string;
    setConnectRepoName: (s: string) => void;
    connectRepoBranch: string;
    setConnectRepoBranch: (s: string) => void;
    connectSubmitting: boolean;
    selectedProjectId: string | null;
    handleConnectRepo: () => Promise<void>;
    reposError: string | null;
    reposLoading: boolean;
    repos: { id: string; repoFullName: string; defaultBranch: string | null }[];
    isSectionCollapsed: (id: string) => boolean;
    toggleSection: (id: string) => void;
    running: boolean;
    runAudit: () => void;
    auditRating: number | null;
    auditRatingLabel: string | null;
    handleCopyAuditPrompt: () => Promise<void>;
    auditPromptCopied: boolean;
    auditPromptText: string;
    payload: AuditPayload | null;
    findings: AuditFinding[];
    requestError: string | null;
    codeRating: number;
    codeRatingLabel: string;
    ratingQuestion: string;
    setRatingQuestion: (s: string) => void;
    questionCopied: boolean;
    handleCopyQuestion: () => Promise<void>;
    staffPromptText: string;
    setStaffPromptText: (s: string) => void;
    promptCopied: boolean;
    handleCopyPrompt: () => Promise<void>;
    wireframe: WireframeSnapshot | null;
    generateWireframe: () => void;
    projectFlowRefreshNonce: number;
    updateProjectFlowDiagram: () => void;
    securityAuditRunning: boolean;
    securityAuditError: string | null;
    securityAuditSummary: SecurityAuditSummary | null;
    securityAuditFindings: SecurityAuditFinding[];
    securityAuditGeneratedAt: string | null;
    securityAuditScore: number | null;
    handleSecurityAuditClick: (
      event: React.MouseEvent<HTMLButtonElement>
    ) => void;
    tokenFindingsCopied: boolean;
    securityFindingsCopied: boolean;
    handleCopyTokenFindings: () => Promise<void>;
    handleCopySecurityFindings: () => Promise<void>;
  }
) {
  const {
    hasSelectedProject,
    connectRepoName,
    setConnectRepoName,
    connectRepoBranch,
    setConnectRepoBranch,
    connectSubmitting,
    selectedProjectId,
    handleConnectRepo,
    reposError,
    reposLoading,
    repos,
    isSectionCollapsed,
    toggleSection,
    running,
    runAudit,
    auditRating,
    auditRatingLabel,
    handleCopyAuditPrompt,
    auditPromptCopied,
    auditPromptText,
    payload,
    findings,
    requestError,
    codeRating,
    codeRatingLabel,
    ratingQuestion,
    setRatingQuestion,
    questionCopied,
    handleCopyQuestion,
    staffPromptText,
    setStaffPromptText,
    promptCopied,
    handleCopyPrompt,
    wireframe,
    generateWireframe,
    projectFlowRefreshNonce,
    updateProjectFlowDiagram,
    securityAuditRunning,
    securityAuditError,
    securityAuditSummary,
    securityAuditFindings,
    securityAuditGeneratedAt,
    securityAuditScore,
    handleSecurityAuditClick,
    tokenFindingsCopied,
    securityFindingsCopied,
    handleCopyTokenFindings,
    handleCopySecurityFindings,
  } = ctx;
  const ratingSuggestions = buildCodeRatingSuggestions(findings);
  if (sectionId === "code-repos") {
    return (
      <CollapsibleSection
        sectionId="code-repos"
        title="Project codebases"
        collapsed={isSectionCollapsed("code-repos")}
        onToggle={() => toggleSection("code-repos")}
        sectionClassName="code-page-repos-section code-page-body-section"
        headingId="code-page-repos-heading"
        headerTrailing={dragHandle}
      >
        {!hasSelectedProject ? (
          <p className="code-page-repos-empty">
            Select a project to connect its codebase.
          </p>
        ) : (
          <>
            <p className="code-page-repos-copy">
              Connect one or more GitHub repositories to this project. Each
              project can have its own codebase connections.
            </p>
            <div className="code-page-repos-connect">
              <label className="code-page-field">
                <span className="code-page-field-label">
                  GitHub repo (owner/name)
                </span>
                <input
                  type="text"
                  value={connectRepoName}
                  onChange={(e) => setConnectRepoName(e.target.value)}
                  placeholder="acme/monorepo"
                  className="expenses-input"
                />
              </label>
              <label className="code-page-field">
                <span className="code-page-field-label">
                  Default branch (optional)
                </span>
                <input
                  type="text"
                  value={connectRepoBranch}
                  onChange={(e) => setConnectRepoBranch(e.target.value)}
                  placeholder="main"
                  className="expenses-input"
                />
              </label>
              <button
                type="button"
                className="code-page-run-btn"
                disabled={
                  !connectRepoName.trim() ||
                  connectSubmitting ||
                  !selectedProjectId
                }
                onClick={() => void handleConnectRepo()}
              >
                {connectSubmitting ? "Connecting…" : "Connect repo"}
              </button>
            </div>
            {reposError && (
              <p className="code-page-error-inline">{reposError}</p>
            )}
            <div className="code-page-repos-list">
              {reposLoading && !repos.length && (
                <p className="code-page-repos-empty">Loading repositories…</p>
              )}
              {!reposLoading && repos.length === 0 && (
                <p className="code-page-repos-empty">
                  No repositories connected yet.
                </p>
              )}
              {repos.length > 0 && (
                <ul className="code-page-repos-items">
                  {repos.map((repo) => (
                    <li key={repo.id} className="code-page-repo-item">
                      <span className="code-page-repo-name">
                        {repo.repoFullName}
                      </span>
                      {repo.defaultBranch && (
                        <span className="code-page-repo-branch">
                          {repo.defaultBranch}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CollapsibleSection>
    );
  }
  if (sectionId === "code-token-usage") {
    return (
      <TokenUsageGraph
        collapsed={isSectionCollapsed("code-token-usage")}
        onToggle={() => toggleSection("code-token-usage")}
        dragHandle={dragHandle}
      />
    );
  }
  if (sectionId === "code-audit") {
    return (
      <CollapsibleSection
        sectionId="code-audit"
        title="Token audit"
        collapsed={isSectionCollapsed("code-audit")}
        onToggle={() => toggleSection("code-audit")}
        sectionClassName="code-page-audit-section code-page-summary-section code-page-body-section"
        headingId="code-page-audit-heading"
        headerTrailing={dragHandle}
      >
        <p className="code-page-audit-copy">
          Analyze this repo for token-efficiency hotspots across web, backend,
          and app surfaces.
        </p>
        <button
          type="button"
          className="code-page-run-btn"
          onClick={runAudit}
          disabled={running}
        >
          {running ? "Running audit…" : "Run token audit"}
        </button>
        {auditRating != null && (
          <p className="code-page-rating-score">
            <span className="code-page-rating-score-value">
              {auditRating.toFixed(1)}/10
            </span>
            <span className="code-page-rating-score-label">
              {auditRatingLabel}
            </span>
          </p>
        )}
        <div className="code-page-rating-prompt-block">
          <div className="code-page-rating-prompt-header">
            <label
              htmlFor="code-audit-prompt"
              className="code-page-rating-prompt-label"
            >
              Prompt to improve token audit score:
            </label>
            <button
              type="button"
              className="code-page-rating-prompt-copy-btn"
              onClick={handleCopyAuditPrompt}
            >
              {auditPromptCopied ? "Copied" : "Copy"}
            </button>
          </div>
          <textarea
            id="code-audit-prompt"
            className="code-page-rating-prompt"
            readOnly
            spellCheck={false}
            rows={8}
            value={auditPromptText}
          />
        </div>
        {payload?.summary && (
          <section
            className="code-page-summary"
            aria-labelledby="code-page-summary-heading"
          >
            <h3 id="code-page-summary-heading">Audit summary</h3>
            <div className="code-page-summary-grid">
              <div className="code-page-summary-item">
                <span className="code-page-summary-label">Source Files</span>
                <strong>{payload.summary.sourceFiles}</strong>
              </div>
              <div className="code-page-summary-item">
                <span className="code-page-summary-label">Source Lines</span>
                <strong>{payload.summary.sourceLines}</strong>
              </div>
              <div className="code-page-summary-item">
                <span className="code-page-summary-label">High</span>
                <strong>{payload.summary.high}</strong>
              </div>
              <div className="code-page-summary-item">
                <span className="code-page-summary-label">Medium</span>
                <strong>{payload.summary.medium}</strong>
              </div>
              <div className="code-page-summary-item">
                <span className="code-page-summary-label">Low</span>
                <strong>{payload.summary.low}</strong>
              </div>
            </div>
          </section>
        )}
        {payload && (
          <section className="code-page-body">
            <div className="code-page-findings-header">
              <h3
                id="code-findings-heading"
                className="code-page-findings-title"
              >
                Audit findings
              </h3>
              <button
                type="button"
                className="code-page-rating-prompt-copy-btn"
                onClick={handleCopyTokenFindings}
                disabled={findings.length === 0}
              >
                {tokenFindingsCopied ? "Copied" : "Copy findings"}
              </button>
            </div>
            <section className="code-page-findings">
              {findings.length === 0 && !requestError && (
                <div className="code-page-empty">No findings.</div>
              )}
              {findings.map((finding) => (
                <article key={finding.id} className="code-finding">
                  <header className="code-finding-header">
                    <h2 className="code-finding-title">{finding.title}</h2>
                    <div className="code-finding-badges">
                      <span
                        className={`code-finding-badge code-finding-badge--${finding.severity}`}
                      >
                        {severityLabel(finding.severity)}
                      </span>
                      <span className="code-finding-badge code-finding-badge--effort">
                        {finding.effort}
                      </span>
                    </div>
                  </header>
                  <p className="code-finding-why">{finding.why}</p>
                  <p className="code-finding-action">{finding.action}</p>
                  {(finding.file || finding.lines != null) && (
                    <p className="code-finding-meta">
                      {finding.file ? (
                        <>
                          File:{" "}
                          <span className="code-finding-file-link">
                            {finding.file}
                          </span>
                        </>
                      ) : (
                        ""
                      )}
                      {finding.file && finding.lines != null ? " · " : ""}
                      {finding.lines != null ? `${finding.lines} lines` : ""}
                    </p>
                  )}
                </article>
              ))}
            </section>
          </section>
        )}
      </CollapsibleSection>
    );
  }
  if (sectionId === "code-release-notes") {
    return (
      <CollapsibleSection
        sectionId="code-release-notes"
        title="Release Notes"
        collapsed={isSectionCollapsed("code-release-notes")}
        onToggle={() => toggleSection("code-release-notes")}
        sectionClassName="code-page-release-notes-section code-page-body-section"
        headingId="code-page-release-notes-heading"
        headerTrailing={dragHandle}
      >
        <p className="code-page-audit-copy">
          Recent product and engineering updates across the entire app.
        </p>
        {APP_RELEASE_NOTES.length > 0 ? (
          <ol className="code-page-release-notes-list">
            {APP_RELEASE_NOTES.map((note) => (
              <li
                key={`${note.date}-${note.title}`}
                className="code-page-release-note"
              >
                <p className="code-page-release-note-meta">
                  <span className="code-page-release-note-date">
                    {formatReleaseDate(note.date)}
                  </span>
                  <span className="code-page-release-note-area">{note.area}</span>
                </p>
                <h3 className="code-page-release-note-title">{note.title}</h3>
                <p className="code-page-release-note-details">{note.details}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="code-page-empty">
            No release notes yet. Add entries in <code>web/lib/releaseNotes.ts</code>.
          </div>
        )}
      </CollapsibleSection>
    );
  }
  if (sectionId === "code-rating") {
    return (
      <CollapsibleSection
        sectionId="code-rating"
        title="Codebase rating"
        collapsed={isSectionCollapsed("code-rating")}
        onToggle={() => toggleSection("code-rating")}
        sectionClassName="code-page-rating"
        headingId="code-page-rating-heading"
        headerTrailing={dragHandle}
      >
        <p className="code-page-rating-score">
          <span className="code-page-rating-score-value">
            {codeRating.toFixed(1)}/10
          </span>
          <span className="code-page-rating-score-label">
            {codeRatingLabel}
          </span>
        </p>
        <details className="code-page-rating-description">
          <summary>How this rating is calculated</summary>
          <p>
            The codebase rating reflects engineering quality across structure,
            test reliability, type safety, performance, and UX. When a token
            audit exists, this score follows the latest audit severity mix;
            without an audit, it uses the staff baseline.
          </p>
        </details>
        <section className="code-page-rating-suggestions">
          <h3 className="code-page-rating-suggestions-title">
            Suggestions to improve and keep this score high
          </h3>
          <ul className="code-page-rating-suggestions-list">
            {ratingSuggestions.map((suggestion) => (
              <li
                key={suggestion}
                className="code-page-rating-suggestions-item"
              >
                {suggestion}
              </li>
            ))}
          </ul>
        </section>
        <div className="code-page-rating-prompt-block code-page-rating-prompt-block--short">
          <div className="code-page-rating-prompt-header">
            <label
              htmlFor="code-rating-question"
              className="code-page-rating-prompt-label"
            >
              Ask an AI to rate the codebase:
            </label>
            <button
              type="button"
              className="code-page-rating-prompt-copy-btn"
              onClick={handleCopyQuestion}
            >
              {questionCopied ? "Copied" : "Copy"}
            </button>
          </div>
          <AutoResizeTextarea
            id="code-rating-question"
            className="code-page-rating-prompt code-page-rating-prompt--short"
            rows={1}
            value={ratingQuestion}
            onChange={(e) => setRatingQuestion(e.target.value)}
          />
        </div>
        <div className="code-page-rating-prompt-block">
          <div className="code-page-rating-prompt-header">
            <label
              htmlFor="code-rating-prompt"
              className="code-page-rating-prompt-label"
            >
              Prompt to improve codebase rating:
            </label>
            <button
              type="button"
              className="code-page-rating-prompt-copy-btn"
              onClick={handleCopyPrompt}
            >
              {promptCopied ? "Copied" : "Copy"}
            </button>
          </div>
          <AutoResizeTextarea
            id="code-rating-prompt"
            className="code-page-rating-prompt"
            rows={8}
            value={staffPromptText}
            onChange={(e) => setStaffPromptText(e.target.value)}
          />
        </div>
      </CollapsibleSection>
    );
  }
  if (sectionId === "code-security") {
    return (
      <CollapsibleSection
        sectionId="code-security"
        title="Security"
        collapsed={isSectionCollapsed("code-security")}
        onToggle={() => toggleSection("code-security")}
        sectionClassName="code-page-security-section code-page-body-section"
        headingId="code-page-security-heading"
        headerTrailing={dragHandle}
      >
        <p className="code-page-audit-copy">
          Run a real dependency vulnerability audit and generate a security
          score from the current findings.
        </p>
        <button
          type="button"
          className="code-page-run-btn"
          onClick={handleSecurityAuditClick}
          disabled={securityAuditRunning}
        >
          {securityAuditRunning
            ? "Running security audit…"
            : "Run security audit"}
        </button>
        {securityAuditError && (
          <p className="code-page-error-inline">{securityAuditError}</p>
        )}
        {securityAuditScore != null && (
          <p className="code-page-rating-score" aria-live="polite">
            <span className="code-page-rating-score-value">
              {securityAuditScore.toFixed(1)}/10
            </span>
            <span className="code-page-rating-score-label">
              Security audit score
            </span>
          </p>
        )}
        {securityAuditGeneratedAt && (
          <p className="code-page-generated-at">
            Last security audit:{" "}
            {new Date(securityAuditGeneratedAt).toLocaleString()}
          </p>
        )}
        {securityAuditSummary && (
          <section className="code-page-summary">
            <h3>Vulnerability summary</h3>
            <div className="code-page-summary-grid">
              <div className="code-page-summary-item">
                <span className="code-page-summary-label">Critical</span>
                <strong>{securityAuditSummary.critical}</strong>
              </div>
              <div className="code-page-summary-item">
                <span className="code-page-summary-label">High</span>
                <strong>{securityAuditSummary.high}</strong>
              </div>
              <div className="code-page-summary-item">
                <span className="code-page-summary-label">Moderate</span>
                <strong>{securityAuditSummary.moderate}</strong>
              </div>
              <div className="code-page-summary-item">
                <span className="code-page-summary-label">Low</span>
                <strong>{securityAuditSummary.low}</strong>
              </div>
              <div className="code-page-summary-item">
                <span className="code-page-summary-label">Dependencies</span>
                <strong>{securityAuditSummary.totalDependencies}</strong>
              </div>
            </div>
          </section>
        )}
        {securityAuditFindings.length > 0 && (
          <section className="code-page-body">
            <div className="code-page-findings-header">
              <h3 className="code-page-findings-title">
                Top security findings
              </h3>
              <button
                type="button"
                className="code-page-rating-prompt-copy-btn"
                onClick={handleCopySecurityFindings}
              >
                {securityFindingsCopied ? "Copied" : "Copy findings"}
              </button>
            </div>
            <section className="code-page-findings">
              {securityAuditFindings.map((finding) => (
                <article key={finding.id} className="code-finding">
                  <header className="code-finding-header">
                    <h2 className="code-finding-title">{finding.title}</h2>
                    <div className="code-finding-badges">
                      <span
                        className={`code-finding-badge code-finding-badge--${finding.severity}`}
                      >
                        {finding.severity}
                      </span>
                    </div>
                  </header>
                  <p className="code-finding-action">
                    Package: <strong>{finding.moduleName}</strong>
                  </p>
                  <p className="code-finding-why">{finding.recommendation}</p>
                  {finding.url && (
                    <p className="code-finding-meta">
                      <a href={finding.url} target="_blank" rel="noreferrer">
                        Advisory details
                      </a>
                    </p>
                  )}
                </article>
              ))}
            </section>
          </section>
        )}
      </CollapsibleSection>
    );
  }
  if (sectionId === "code-health") {
    return (
      <CollapsibleSection
        sectionId="code-health"
        title="Code Health"
        collapsed={isSectionCollapsed("code-health")}
        onToggle={() => toggleSection("code-health")}
        sectionClassName="code-page-code-health-section code-page-body-section"
        headingId="code-page-code-health-heading"
        headerTrailing={dragHandle}
      >
        <CodeHealthSection />
      </CollapsibleSection>
    );
  }
  if (sectionId === "code-wireframe") {
    return (
      <CollapsibleSection
        sectionId="code-wireframe"
        title="Entire app flow wireframe"
        collapsed={isSectionCollapsed("code-wireframe")}
        onToggle={() => toggleSection("code-wireframe")}
        sectionClassName="code-page-wireframe-section code-wireframe-section"
        headingId="code-wireframe-map-heading"
        headerTrailing={dragHandle}
      >
        <p className="code-page-wireframe-copy">
          Generate a visual map of the entire app flow, with overlays from the
          latest token audit.
        </p>
        <button
          type="button"
          className="code-page-wireframe-btn"
          onClick={generateWireframe}
          disabled={running}
        >
          {wireframe
            ? "Refresh app flow wireframe"
            : "Generate app flow wireframe"}
        </button>
        {!payload && (
          <p className="code-page-wireframe-hint">
            Run a token audit first to attach current hotspots to this
            wireframe.
          </p>
        )}
        {wireframe && (
          <section className="code-wireframe" aria-live="polite">
            <header className="code-wireframe-header">
              <h3 className="code-wireframe-title">
                Entire App Flow Wireframe
              </h3>
              <p className="code-wireframe-meta">
                Updated {new Date(wireframe.generatedAt).toLocaleString()}
                {wireframe.runId
                  ? ` · from run ${wireframe.runId}`
                  : " · baseline mode"}
              </p>
            </header>
            <div className="code-wireframe-lanes">
              {wireframe.lanes.map((lane) => (
                <section key={lane.id} className="code-wireframe-lane">
                  <h3 className="code-wireframe-lane-title">{lane.title}</h3>
                  <div className="code-wireframe-track">
                    {lane.nodes.map((node, index) => (
                      <React.Fragment key={node.id}>
                        <article
                          className={`code-wireframe-node tone-${node.tone}`}
                        >
                          <h4 className="code-wireframe-node-title">
                            {node.title}
                          </h4>
                          <p className="code-wireframe-node-subtitle">
                            {node.subtitle}
                          </p>
                        </article>
                        {index < lane.nodes.length - 1 && (
                          <span
                            className="code-wireframe-arrow"
                            aria-hidden="true"
                          >
                            →
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <section className="code-wireframe-highlights">
              <h3 className="code-wireframe-lane-title">Current Hotspots</h3>
              <ul className="code-wireframe-highlight-list">
                {wireframe.highlights.map((item) => (
                  <li key={item} className="code-wireframe-highlight-item">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </section>
        )}
      </CollapsibleSection>
    );
  }
  if (sectionId === "code-project-flow") {
    return (
      <CollapsibleSection
        sectionId="code-project-flow"
        title="Project flow diagram"
        collapsed={isSectionCollapsed("code-project-flow")}
        onToggle={() => toggleSection("code-project-flow")}
        sectionClassName="code-page-project-flow-section code-page-body-section"
        headingId="code-page-project-flow-heading"
        headerTrailing={dragHandle}
      >
        <p className="code-page-project-flow-copy">
          How the monorepo fits together: shared packages, backend modules, web
          (Next.js), app (React Native), and API flow.
        </p>
        <button
          type="button"
          className="code-page-wireframe-btn"
          onClick={updateProjectFlowDiagram}
        >
          Update flow diagram
        </button>
        <ProjectFlowDiagram
          key={projectFlowRefreshNonce}
          visible={!isSectionCollapsed("code-project-flow")}
        />
      </CollapsibleSection>
    );
  }
  return null;
}
