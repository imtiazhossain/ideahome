import type { NextApiRequest, NextApiResponse } from "next";
import { spawn } from "child_process";
import { ensureInternalApiAccess } from "../../lib/server/internal-api-access";
import { getMonorepoRoot } from "../../lib/server/monorepo-root";

type SecuritySeverity = "critical" | "high" | "moderate" | "low";

type SecuritySummary = {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  totalDependencies: number;
};

type SecurityFinding = {
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
  summary: SecuritySummary;
  findings: SecurityFinding[];
  error?: string;
};

type PnpmAuditAdvisory = {
  id: number;
  module_name?: string;
  title?: string;
  severity?: string;
  recommendation?: string;
  url?: string;
};

type PnpmAuditPayload = {
  advisories?: Record<string, PnpmAuditAdvisory>;
  metadata?: {
    vulnerabilities?: {
      low?: number;
      moderate?: number;
      high?: number;
      critical?: number;
    };
    totalDependencies?: number;
  };
};

const SEVERITY_WEIGHT: Record<SecuritySeverity, number> = {
  critical: 8,
  high: 3,
  moderate: 1,
  low: 0.3,
};

function emptySummary(): SecuritySummary {
  return { critical: 0, high: 0, moderate: 0, low: 0, totalDependencies: 0 };
}

function toSeverity(input: string | undefined): SecuritySeverity {
  switch (input) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "moderate":
      return "moderate";
    case "low":
      return "low";
    default:
      return "low";
  }
}

function scoreSecurity(summary: SecuritySummary): number {
  const weightedRisk =
    summary.critical * SEVERITY_WEIGHT.critical +
    summary.high * SEVERITY_WEIGHT.high +
    summary.moderate * SEVERITY_WEIGHT.moderate +
    summary.low * SEVERITY_WEIGHT.low;
  if (weightedRisk <= 0) return 10;

  const deps = Math.max(summary.totalDependencies, 1);
  const riskPer100Dependencies = (weightedRisk / deps) * 100;
  let score = 10 - riskPer100Dependencies * 1.35;

  // Explicitly penalize severe unresolved issues even in large dependency sets.
  if (summary.critical > 0) score -= 1.5;
  if (summary.high > 0) score -= 0.5;

  return Number(Math.max(0, Math.min(10, score)).toFixed(1));
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function buildFindings(payload: PnpmAuditPayload): SecurityFinding[] {
  const advisories = payload.advisories ?? {};
  const findings = Object.entries(advisories).map(([id, advisory]) => {
    const severity = toSeverity(advisory.severity);
    return {
      id,
      moduleName: advisory.module_name ?? "unknown",
      title: advisory.title ?? "Untitled advisory",
      severity,
      recommendation: advisory.recommendation ?? "Review and patch package",
      url: advisory.url ?? null,
    };
  });
  const rank: Record<SecuritySeverity, number> = {
    critical: 4,
    high: 3,
    moderate: 2,
    low: 1,
  };
  return findings.sort((a, b) => rank[b.severity] - rank[a.severity]).slice(0, 8);
}

function parseAuditOutput(stdout: string): {
  summary: SecuritySummary;
  findings: SecurityFinding[];
  score: number;
} {
  const jsonBlock = extractJsonObject(stdout);
  if (!jsonBlock) {
    throw new Error("Security audit returned no JSON output");
  }

  const parsed = JSON.parse(jsonBlock) as PnpmAuditPayload;
  const vulnerabilities = parsed.metadata?.vulnerabilities;
  const summary: SecuritySummary = {
    critical: vulnerabilities?.critical ?? 0,
    high: vulnerabilities?.high ?? 0,
    moderate: vulnerabilities?.moderate ?? 0,
    low: vulnerabilities?.low ?? 0,
    totalDependencies: parsed.metadata?.totalDependencies ?? 0,
  };

  return {
    summary,
    findings: buildFindings(parsed),
    score: scoreSecurity(summary),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SecurityAuditResponse>
) {
  const startedAt = Date.now();

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      score: null,
      summary: emptySummary(),
      findings: [],
      error: "Method not allowed",
    });
  }

  const access = ensureInternalApiAccess(req, {
    devOnlyError: "Security audit available in development only",
    localhostError: "Localhost or RUN_COVERAGE_TOKEN required",
  });
  if (!access.allowed) {
    return res.status(access.status).json({
      ok: false,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      score: null,
      summary: emptySummary(),
      findings: [],
      error: access.error,
    });
  }

  const root = getMonorepoRoot();

  try {
    const auditResult = await new Promise<{
      stdout: string;
      stderr: string;
      code: number;
    }>((resolve, reject) => {
      const proc = spawn("pnpm", ["audit", "--prod", "--json"], {
        cwd: root,
      });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      proc.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      proc.on("error", reject);
      proc.on("close", (code) => {
        resolve({ stdout, stderr, code: code ?? 1 });
      });
    });

    const parsed = parseAuditOutput(auditResult.stdout);
    const ok = auditResult.code === 0;

    return res.status(200).json({
      ok,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      score: parsed.score,
      summary: parsed.summary,
      findings: parsed.findings,
      error: ok ? undefined : auditResult.stderr.trim() || undefined,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      score: null,
      summary: emptySummary(),
      findings: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
