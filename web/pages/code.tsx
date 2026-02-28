import React, { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";

type AuditSeverity = "high" | "medium" | "low";
type AuditEffort = "small" | "medium" | "large";

type AuditFinding = {
  id: string;
  title: string;
  severity: AuditSeverity;
  effort: AuditEffort;
  why: string;
  action: string;
  file?: string;
  line?: number;
  lines?: number;
};

type AuditSummary = {
  sourceFiles: number;
  sourceLines: number;
  high: number;
  medium: number;
  low: number;
};

type AuditPayload = {
  ok: boolean;
  runId: string;
  generatedAt: string;
  durationMs: number;
  summary: AuditSummary;
  findings: AuditFinding[];
  error?: string;
};

type CodePreviewPayload = {
  ok: boolean;
  filePath?: string;
  line?: number;
  lines?: string[];
  error?: string;
};

type CodePreviewState = {
  filePath: string;
  startLine: number;
  lines: string[];
  targetLine: number;
};

type WireframeNodeTone = "ui" | "api" | "data" | "hotspot";

type WireframeNode = {
  id: string;
  title: string;
  subtitle: string;
  tone: WireframeNodeTone;
};

type WireframeLane = {
  id: string;
  title: string;
  nodes: WireframeNode[];
};

type WireframeSnapshot = {
  generatedAt: string;
  runId: string | null;
  lanes: WireframeLane[];
  highlights: string[];
};

async function readJsonIfAvailable<T>(
  response: Response
): Promise<{ data: T | null; text: string | null }> {
  const contentType = response.headers.get("content-type") ?? "";
  const bodyText = await response.text();
  if (!contentType.toLowerCase().includes("application/json")) {
    return { data: null, text: bodyText };
  }
  try {
    return { data: JSON.parse(bodyText) as T, text: bodyText };
  } catch {
    return { data: null, text: bodyText };
  }
}

function severityLabel(severity: AuditSeverity): string {
  if (severity === "high") return "High";
  if (severity === "medium") return "Medium";
  return "Low";
}

function bySeverityDesc(a: AuditFinding, b: AuditFinding): number {
  const rank: Record<AuditSeverity, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };
  return rank[b.severity] - rank[a.severity];
}

function findingHighlight(finding: AuditFinding): string {
  const fileRef = finding.file ? ` (${finding.file})` : "";
  return `${severityLabel(finding.severity)}: ${finding.title}${fileRef}`;
}

function buildWireframe(payload: AuditPayload | null): WireframeSnapshot {
  const sortedFindings = [...(payload?.findings ?? [])].sort(bySeverityDesc);
  const topFindings = sortedFindings.slice(0, 3);
  const highlights =
    topFindings.length > 0
      ? topFindings.map(findingHighlight)
      : [
          "Run token audit to attach current code hotspots to this app flow map.",
        ];
  const sourceFiles = payload?.summary.sourceFiles ?? 0;
  const sourceLines = payload?.summary.sourceLines ?? 0;
  const generatedAt = new Date().toISOString();

  return {
    generatedAt,
    runId: payload?.runId ?? null,
    highlights,
    lanes: [
      {
        id: "entry",
        title: "Entry + Auth Flow",
        nodes: [
          {
            id: "client-entry",
            title: "Web + Mobile Entry",
            subtitle: "Next.js pages and React Native tabs",
            tone: "ui",
          },
          {
            id: "sso",
            title: "Login + Callback",
            subtitle: "/login -> /auth/* -> token storage",
            tone: "ui",
          },
          {
            id: "authz",
            title: "Authorized API Access",
            subtitle: "Bearer/cookie token on client requests",
            tone: "hotspot",
          },
        ],
      },
      {
        id: "product",
        title: "Core Product Flow",
        nodes: [
          {
            id: "project-select",
            title: "Project + Org Context",
            subtitle: "select/create project, scoped data",
            tone: "ui",
          },
          {
            id: "board-issues",
            title: "Board + Issues",
            subtitle: "create/update/status/comments/assignee",
            tone: "ui",
          },
          {
            id: "media",
            title: "Media + Files",
            subtitle: "recordings, screenshots, attachments, streams",
            tone: "hotspot",
          },
          {
            id: "checklists",
            title: "Lists + Planning",
            subtitle: "todos, ideas, bugs, features, enhancements",
            tone: "ui",
          },
          {
            id: "quality",
            title: "Tests + Expenses + Code",
            subtitle: "ui/api tests, costs, code insights",
            tone: "ui",
          },
        ],
      },
      {
        id: "backend",
        title: "Backend + Data Flow",
        nodes: [
          {
            id: "rewrite",
            title: "Routing Layer",
            subtitle: "Next rewrites -> backend or /api serverless",
            tone: "api",
          },
          {
            id: "guard-controller",
            title: "JwtAuthGuard + Controllers",
            subtitle: "auth check + request dispatch",
            tone: "api",
          },
          {
            id: "services",
            title: "Domain Services",
            subtitle: "org scope, validation, business logic",
            tone: "api",
          },
          {
            id: "prisma",
            title: "Prisma + PostgreSQL",
            subtitle: "persistent app entities",
            tone: "data",
          },
          {
            id: "storage",
            title: "StorageService + Uploads",
            subtitle: "file/media read-write",
            tone: "data",
          },
        ],
      },
      {
        id: "observability",
        title: "Code Health Overlay",
        nodes: [
          {
            id: "repo-size",
            title: "Source Footprint",
            subtitle: `${sourceFiles} files · ${sourceLines} lines tracked`,
            tone: "data",
          },
          {
            id: "audit-output",
            title: "Token Audit Findings",
            subtitle: `${payload?.findings.length ?? 0} findings from last run`,
            tone: "api",
          },
          {
            id: "wireframe",
            title: "Updated App Flow Wireframe",
            subtitle: "product-map + current engineering hotspots",
            tone: "hotspot",
          },
        ],
      },
    ],
  };
}

export default function CodePage() {
  const [running, setRunning] = useState(false);
  const [payload, setPayload] = useState<AuditPayload | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CodePreviewState | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [wireframe, setWireframe] = useState<WireframeSnapshot | null>(null);

  const findings = payload?.findings ?? [];
  const generatedAt = useMemo(() => {
    if (!payload?.generatedAt) return null;
    return new Date(payload.generatedAt).toLocaleString();
  }, [payload?.generatedAt]);

  async function runAudit() {
    setRunning(true);
    setRequestError(null);
    setPayload(null);
    setPreview(null);
    setPreviewError(null);
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
          ? text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180)
          : "";
        setRequestError(
          `Audit request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
        );
        return;
      }
      setPayload(data);
      setWireframe(buildWireframe(data));
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
  }

  function generateWireframe() {
    setWireframe(buildWireframe(payload));
  }

  async function openFilePreview(filePath: string, line = 1) {
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const params = new URLSearchParams({
        path: filePath,
        line: String(line),
      });
      const response = await fetch(`/api/code-file?${params.toString()}`);
      const { data, text } = await readJsonIfAvailable<CodePreviewPayload>(response);
      if (!data) {
        const detail = text
          ? text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180)
          : "";
        setPreviewError(
          `Failed to load file preview (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
        );
        return;
      }
      if (!response.ok || data.ok !== true || !data.filePath || !data.lines) {
        setPreviewError(data.error ?? `Failed to load file preview (${response.status})`);
        return;
      }
      setPreview({
        filePath: data.filePath,
        startLine: data.line ?? 1,
        lines: data.lines,
        targetLine: line,
      });
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : "Failed to load file preview"
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Code · IdeaHome</title>
      </Head>
      <div className="code-page">
        <header className="code-page-header">
          <Link href="/" className="code-page-back">
            ← Back to IdeaHome
          </Link>
          <h1 className="code-page-title">Code</h1>
          <p className="code-page-subtitle">
            Run a token-efficiency audit and get prioritized refactor guidance.
          </p>
          <div className="code-page-actions">
            <button
              type="button"
              className="code-page-run-btn"
              onClick={runAudit}
              disabled={running}
            >
              {running ? "Running audit…" : "Run token audit"}
            </button>
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
          </div>
        </header>

        {requestError && (
          <section className="code-page-error" aria-live="polite">
            {requestError}
          </section>
        )}

        {payload?.summary && (
          <section className="code-page-summary">
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
          </section>
        )}

        {generatedAt && (
          <p className="code-page-generated-at">
            Last audit: {generatedAt}
            {payload?.durationMs != null ? ` · ${payload.durationMs} ms` : ""}
            {payload?.runId ? ` · run ${payload.runId}` : ""}
          </p>
        )}

        {wireframe && (
          <section className="code-wireframe" aria-live="polite">
            <header className="code-wireframe-header">
              <h2 className="code-wireframe-title">Entire App Flow Wireframe</h2>
              <p className="code-wireframe-meta">
                Updated {new Date(wireframe.generatedAt).toLocaleString()}
                {wireframe.runId ? ` · from run ${wireframe.runId}` : " · baseline mode"}
              </p>
            </header>
            <div className="code-wireframe-lanes">
              {wireframe.lanes.map((lane) => (
                <section key={lane.id} className="code-wireframe-lane">
                  <h3 className="code-wireframe-lane-title">{lane.title}</h3>
                  <div className="code-wireframe-track">
                    {lane.nodes.map((node, index) => (
                      <React.Fragment key={node.id}>
                        <article className={`code-wireframe-node tone-${node.tone}`}>
                          <h4 className="code-wireframe-node-title">{node.title}</h4>
                          <p className="code-wireframe-node-subtitle">
                            {node.subtitle}
                          </p>
                        </article>
                        {index < lane.nodes.length - 1 && (
                          <span className="code-wireframe-arrow" aria-hidden="true">
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

        <div className="code-page-body">
          <section className="code-page-findings">
          {findings.length === 0 && payload && !requestError && (
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
                      <button
                        type="button"
                        className="code-finding-file-link"
                        onClick={() =>
                          openFilePreview(finding.file as string, finding.line ?? 1)
                        }
                      >
                        {finding.file}
                      </button>
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
          <aside className="code-page-preview">
            <div className="code-page-preview-header">
              <h3 className="code-page-preview-title">File Viewer</h3>
              {preview?.filePath && (
                <span className="code-page-preview-path">{preview.filePath}</span>
              )}
            </div>
            {previewLoading && (
              <div className="code-page-preview-empty">Loading file…</div>
            )}
            {!previewLoading && previewError && (
              <div className="code-page-preview-error">{previewError}</div>
            )}
            {!previewLoading && !previewError && !preview && (
              <div className="code-page-preview-empty">
                Click a finding file to preview it here.
              </div>
            )}
            {!previewLoading && !previewError && preview && (
              <pre className="code-page-preview-code">
                {preview.lines.map((lineText, index) => {
                  const lineNo = preview.startLine + index;
                  const highlight = lineNo === preview.targetLine;
                  return (
                    <div
                      key={`${lineNo}-${lineText.slice(0, 16)}`}
                      className={`code-page-preview-line${highlight ? " is-highlighted" : ""}`}
                    >
                      <span className="code-page-preview-line-no">{lineNo}</span>
                      <span className="code-page-preview-line-text">
                        {lineText || " "}
                      </span>
                    </div>
                  );
                })}
              </pre>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
