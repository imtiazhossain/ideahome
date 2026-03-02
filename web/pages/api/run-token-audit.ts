import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { ensureInternalApiAccess } from "../../lib/server/internal-api-access";
import { getMonorepoRoot } from "../../lib/server/monorepo-root";

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

type AuditResponse = {
  ok: boolean;
  runId: string;
  generatedAt: string;
  durationMs: number;
  summary: {
    sourceFiles: number;
    sourceLines: number;
    high: number;
    medium: number;
    low: number;
  };
  findings: AuditFinding[];
  error?: string;
};

const INCLUDED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".md",
  ".json",
]);

const IGNORED_FILE_NAMES = new Set([
  "package-lock.json",
  "bun.lockb",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  "coverage-report",
  "playwright-report",
  "test-results",
  "Pods",
  ".pnpm-store",
  ".turbo",
]);

const DEFAULT_THRESHOLDS = {
  appTsxMax: 800,
  homePageMax: 2000,
  apiClientMax: 1000,
  navBarMax: 1200,
  largestFileMax: 2000,
} as const;

function parseThreshold(envValue: string | undefined, defaultVal: number): number {
  if (envValue === undefined || envValue === "") return defaultVal;
  const n = parseInt(envValue, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultVal;
}

/**
 * Resolve thresholds from env with defaults. Optional env vars (e.g. in .env.local):
 *   TOKEN_AUDIT_APP_TSX_MAX=800
 *   TOKEN_AUDIT_HOME_PAGE_MAX=2000
 *   TOKEN_AUDIT_API_CLIENT_MAX=1000
 *   TOKEN_AUDIT_NAV_BAR_MAX=1200
 *   TOKEN_AUDIT_LARGEST_FILE_MAX=2000
 */
function getThresholds(): typeof DEFAULT_THRESHOLDS {
  return {
    appTsxMax: parseThreshold(process.env.TOKEN_AUDIT_APP_TSX_MAX, DEFAULT_THRESHOLDS.appTsxMax),
    homePageMax: parseThreshold(process.env.TOKEN_AUDIT_HOME_PAGE_MAX, DEFAULT_THRESHOLDS.homePageMax),
    apiClientMax: parseThreshold(process.env.TOKEN_AUDIT_API_CLIENT_MAX, DEFAULT_THRESHOLDS.apiClientMax),
    navBarMax: parseThreshold(process.env.TOKEN_AUDIT_NAV_BAR_MAX, DEFAULT_THRESHOLDS.navBarMax),
    largestFileMax: parseThreshold(process.env.TOKEN_AUDIT_LARGEST_FILE_MAX, DEFAULT_THRESHOLDS.largestFileMax),
  } as typeof DEFAULT_THRESHOLDS;
}

function countLines(content: string): number {
  if (!content) return 0;
  return content.split(/\r\n|\n|\r/).length;
}

function shouldIgnoreDirectory(name: string, relPath: string): boolean {
  if (IGNORED_DIRS.has(name)) return true;
  if (name === ".next" || name.startsWith(".next.")) return true;
  if (relPath.includes("android/app/.cxx")) return true;
  if (relPath.startsWith("app/android/.gradle")) return true;
  if (relPath.startsWith("backend/src/coverage")) return true;
  return false;
}

function collectSourceFiles(root: string): Array<{ relPath: string; lines: number }> {
  const collected: Array<{ relPath: string; lines: number }> = [];
  const stack = ["web", "backend", "app", "mobile", "packages", "docs"];

  while (stack.length > 0) {
    const relDir = stack.pop() as string;
    const absDir = path.join(root, relDir);
    if (!fs.existsSync(absDir)) continue;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const childRel = path.join(relDir, entry.name);
      const childAbs = path.join(root, childRel);
      if (entry.isDirectory()) {
        if (shouldIgnoreDirectory(entry.name, childRel)) continue;
        stack.push(childRel);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!INCLUDED_EXTENSIONS.has(ext)) continue;
      if (IGNORED_FILE_NAMES.has(entry.name)) continue;
      try {
        const content = fs.readFileSync(childAbs, "utf8");
        collected.push({
          relPath: childRel.replaceAll(path.sep, "/"),
          lines: countLines(content),
        });
      } catch {
        // ignore unreadable files
      }
    }
  }

  return collected;
}

function directoryFootprint(root: string, relDir: string): { files: number; bytes: number } {
  const absDir = path.join(root, relDir);
  if (!fs.existsSync(absDir)) return { files: 0, bytes: 0 };
  let files = 0;
  let bytes = 0;
  const stack = [absDir];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
        continue;
      }
      try {
        const stat = fs.statSync(next);
        if (!stat.isFile()) continue;
        files += 1;
        bytes += stat.size;
      } catch {
        // ignore
      }
    }
  }

  return { files, bytes };
}

function toMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuditResponse>
) {
  const startedAt = Date.now();
  const runId = `${startedAt}-${Math.floor(Math.random() * 1_000_000)}`;

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      runId,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      summary: { sourceFiles: 0, sourceLines: 0, high: 0, medium: 0, low: 0 },
      findings: [],
      error: "Method not allowed",
    });
  }

  const access = ensureInternalApiAccess(req, {
    devOnlyError: "Token audit is only available in development",
    localhostError:
      "Token audit requires localhost access or RUN_COVERAGE_TOKEN configuration.",
  });
  if (!access.allowed) {
    return res.status(access.status).json({
      ok: false,
      runId,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      summary: { sourceFiles: 0, sourceLines: 0, high: 0, medium: 0, low: 0 },
      findings: [],
      error: access.error,
    });
  }

  try {
    const root = getMonorepoRoot();
    const thresholds = getThresholds();
    const sourceFiles = collectSourceFiles(root);
    const totalSourceLines = sourceFiles.reduce((sum, f) => sum + f.lines, 0);
    const findings: AuditFinding[] = [];

    const byPath = new Map(sourceFiles.map((f) => [f.relPath, f]));
    const largest = [...sourceFiles].sort((a, b) => b.lines - a.lines);

    const apiClient = byPath.get("web/lib/api.ts");
    if (apiClient && apiClient.lines >= thresholds.apiClientMax) {
      findings.push({
        id: "api-monolith",
        title: "Web API client is oversized",
        severity: "medium",
        effort: "medium",
        why: `${apiClient.lines} lines mixes auth, storage, and domain APIs.`,
        action:
          "Split into `web/lib/api/{auth,http,issues,projects,tests,ideas,expenses}.ts`.",
        file: apiClient.relPath,
        line: 1,
        lines: apiClient.lines,
      });
    }

    const navBar = byPath.get("web/components/ProjectNavBar.tsx");
    if (navBar && navBar.lines >= thresholds.navBarMax) {
      findings.push({
        id: "navbar-monolith",
        title: "ProjectNavBar has too many responsibilities",
        severity: "medium",
        effort: "medium",
        why: `${navBar.lines} lines combines nav, settings, persistence, and search.`,
        action:
          "Extract tab prefs, search, and settings into separate hooks/components.",
        file: navBar.relPath,
        line: 1,
        lines: navBar.lines,
      });
    }

    const appTsx = byPath.get("app/App.tsx");
    if (appTsx && appTsx.lines >= thresholds.appTsxMax) {
      findings.push({
        id: "app-monolith",
        title: "React Native App.tsx is too large",
        severity: "high",
        effort: "large",
        why: `${appTsx.lines} lines in one file dominates context; extract screens, hooks, and shared components to app/src/.`,
        action:
          "Split into app/src/screens/*, app/src/hooks/*, app/src/components/*; keep App.tsx as thin shell.",
        file: appTsx.relPath,
        line: 1,
        lines: appTsx.lines,
      });
    }

    const homePage = byPath.get("web/features/board/HomePage.tsx");
    if (homePage && homePage.lines >= thresholds.homePageMax) {
      findings.push({
        id: "homepage-monolith",
        title: "Board HomePage is monolithic",
        severity: "high",
        effort: "large",
        why: `${homePage.lines} lines in one page increases prompt size and edit risk.`,
        action:
          "Split into web/features/board/* (columns, detail panel, comments, media) with hooks per concern.",
        file: homePage.relPath,
        line: 1,
        lines: homePage.lines,
      });
    }

    const coverageDir = directoryFootprint(root, "web/public/coverage-report");
    if (coverageDir.files > 0) {
      findings.push({
        id: "coverage-artifacts",
        title: "Coverage report artifacts present in web/public",
        severity: "medium",
        effort: "small",
        why: `${coverageDir.files} files (${toMb(coverageDir.bytes)} MB) can pollute context discovery.`,
        action:
          "Avoid tracking generated coverage HTML; regenerate on demand in CI/local.",
        file: "web/public/coverage-report",
      });
    }

    const uploadsDir = directoryFootprint(root, "backend/uploads");
    if (uploadsDir.files > 0) {
      findings.push({
        id: "uploads-artifacts",
        title: "Runtime upload files committed in repo",
        severity: "medium",
        effort: "small",
        why: `${uploadsDir.files} files (${toMb(uploadsDir.bytes)} MB) add non-source noise to scans.`,
        action:
          "Keep uploads out of git and use storage volume or object storage for local/dev data.",
        file: "backend/uploads",
      });
    }

    const hasArchitectureDoc = fs.existsSync(path.join(root, "ARCHITECTURE.md"));
    if (!hasArchitectureDoc) {
      findings.push({
        id: "missing-architecture-doc",
        title: "Missing compact architecture reference",
        severity: "low",
        effort: "small",
        why: "Without a short architecture map, prompts repeatedly restate structure.",
        action:
          "Add `ARCHITECTURE.md` with key modules, data flow, and coding conventions.",
        file: "ARCHITECTURE.md",
      });
    }

    const topFile = largest[0];
    if (topFile && topFile.lines > thresholds.largestFileMax) {
      const topList = largest
        .slice(0, 5)
        .map((f) => `${f.relPath} (${f.lines} lines)`);
      findings.push({
        id: "largest-files",
        title: "Top large files dominate context budget",
        severity: "low",
        effort: "small",
        why: `Largest files: ${topList.join(", ")}. Files over ${thresholds.largestFileMax} lines increase prompt size.`,
        action:
          "Decompose the largest file(s) into smaller modules (e.g. extract hooks or components) until under threshold.",
      });
    }

    const summary = {
      sourceFiles: sourceFiles.length,
      sourceLines: totalSourceLines,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
    };

    return res.status(200).json({
      ok: true,
      runId,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      summary,
      findings,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      runId,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      summary: { sourceFiles: 0, sourceLines: 0, high: 0, medium: 0, low: 0 },
      findings: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
