/**
 * Types and pure helpers for the Code page (audit payload, wireframe, rating prompts).
 * Shared by useCodePageState and code.tsx.
 */

export type AuditSeverity = "high" | "medium" | "low";
export type AuditEffort = "small" | "medium" | "large";

export type AuditFinding = {
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

export type AuditSummary = {
  sourceFiles: number;
  sourceLines: number;
  high: number;
  medium: number;
  low: number;
};

export type AuditPayload = {
  ok: boolean;
  runId: string;
  generatedAt: string;
  durationMs: number;
  summary: AuditSummary;
  findings: AuditFinding[];
  error?: string;
};

export type WireframeNodeTone = "ui" | "api" | "data" | "hotspot";

export type WireframeNode = {
  id: string;
  title: string;
  subtitle: string;
  tone: WireframeNodeTone;
};

export type WireframeLane = {
  id: string;
  title: string;
  nodes: WireframeNode[];
};

export type WireframeSnapshot = {
  generatedAt: string;
  runId: string | null;
  lanes: WireframeLane[];
  highlights: string[];
};

export const STAFF_CODE_RATING = 7.5;

export async function readJsonIfAvailable<T>(
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

function bySeverityRank(a: AuditFinding, b: AuditFinding): number {
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

export function severityLabel(severity: AuditSeverity): string {
  if (severity === "high") return "High";
  if (severity === "medium") return "Medium";
  return "Low";
}

export function buildWireframe(
  payload: AuditPayload | null
): WireframeSnapshot {
  const sortedFindings = [...(payload?.findings ?? [])].sort(bySeverityRank);
  const topFindings = sortedFindings.slice(0, 3);
  const highlights =
    topFindings.length > 0
      ? topFindings.map(findingHighlight)
      : ["Run token audit to attach hotspots to this map."];
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

export function computeAuditRating(payload: AuditPayload | null): number | null {
  if (!payload || !payload.summary) return null;
  const { high, medium, low } = payload.summary;
  let score = 10;
  score -= high * 0.5;
  score -= medium * 0.2;
  score -= low * 0.05;
  if (score < 1) score = 1;
  if (score > 10) score = 10;
  return Math.round(score * 10) / 10;
}

export function describeRating(score: number): string {
  if (score >= 9) return "Excellent, production-ready codebase";
  if (score >= 7.5) return "Strong indie-quality codebase";
  if (score >= 6) return "Decent, with room for cleanup";
  return "Needs focused refactors";
}

export function buildStaffRatingPrompt(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return (
    "You are an AI staff-level engineer helping improve the Idea Home monorepo.\n\n" +
    `The Code page shows a staff-style codebase rating of ${rounded.toFixed(
      1
    )}/10. This rating reflects overall engineering quality: architecture, duplication, test coverage (unit/integration/e2e), type safety, performance, accessibility, and UX for both web and native apps.\n\n` +
    "Goal: propose and, where possible, implement concrete, high-leverage code and test changes that would honestly move this rating closer to 10/10 without gaming metrics.\n\n" +
    "Constraints:\n" +
    "- Prefer small, focused PR-sized changes over huge rewrites.\n" +
    '- Prioritize: (1) decomposing remaining "god" components/hooks, (2) adding targeted tests around complex flows (board, assistant, nav/tab prefs, finances/Plaid), (3) tightening types and error handling, and (4) performance/accessibility wins that users would feel.\n' +
    "- Do not change the rating UI directly just to bump the number; only adjust it when the underlying codebase meaningfully improves.\n\n" +
    "First, scan the repo to identify the highest-impact structural or testing gaps, then propose a short, ordered plan of concrete edits you will make in this session."
  );
}

export function buildTokenAuditPrompt(score: number | null): string {
  const base = score ?? 10;
  const rounded = Math.round(base * 10) / 10;
  return (
    "You are an AI assistant focused on token-efficiency for the Idea Home monorepo.\n\n" +
    `Token audit score: ${rounded.toFixed(1)}/10. Analyze backend, web, and app; say exactly what to change to reach 10/10 without hurting clarity or behavior.\n\n` +
    "Focus on: verbose prompts/copy, duplicated schemas or config, large payloads/logs/AI responses, wasteful token patterns.\n\n" +
    "For each: file+location, 1–2 sentence description, short proposed change, why it reduces tokens, impact (low/medium/high). Prioritize smallest, safest changes."
  );
}
