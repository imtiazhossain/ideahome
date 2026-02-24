import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";

function getMonorepoRoot(): string {
  const cwd = process.cwd();
  const here = path.join(cwd, "package.json");
  if (fs.existsSync(here)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(here, "utf-8"));
      if (pkg.workspaces) return cwd;
    } catch {
      // ignore
    }
  }
  return path.resolve(cwd, "..");
}

type CoverageEntry = {
  s: Record<string, number>;
  statementMap: Record<
    string,
    { start: { line: number }; end: { line: number } }
  >;
};

/**
 * GET /api/coverage-gaps
 * Reads backend coverage report and returns files sorted by lowest statement coverage
 * so the user knows where to add tests to increase coverage.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{
    files?: { file: string; path: string; statementPct: number }[];
    error?: string;
  }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const root = getMonorepoRoot();
  const coveragePath = path.join(
    root,
    "backend",
    "src",
    "coverage",
    "coverage-final.json"
  );

  if (!fs.existsSync(coveragePath)) {
    return res.status(200).json({
      error:
        "No coverage data. Run “Run coverage” first to generate the report.",
    });
  }

  try {
    const raw = fs.readFileSync(coveragePath, "utf-8");
    const data: Record<string, CoverageEntry> = JSON.parse(raw);

    const backendSrc = path.join(root, "backend", "src");
    const files: { file: string; path: string; statementPct: number }[] = [];

    for (const [absPath, entry] of Object.entries(data)) {
      const relPath = path.relative(backendSrc, absPath);
      if (relPath.startsWith("..")) continue;
      const statements = entry.s;
      const total = Object.keys(statements).length;
      if (total === 0) continue;
      const covered = Object.values(statements).filter((h) => h > 0).length;
      const statementPct = Math.round((covered / total) * 100);
      files.push({
        file: path.basename(relPath),
        path: relPath,
        statementPct,
      });
    }

    files.sort((a, b) => a.statementPct - b.statementPct);

    return res.status(200).json({ files });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
