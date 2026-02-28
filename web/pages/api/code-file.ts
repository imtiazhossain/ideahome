import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { ensureInternalApiAccess } from "../../lib/server/internal-api-access";
import { getMonorepoRoot } from "../../lib/server/monorepo-root";

type CodeFileResponse = {
  ok: boolean;
  filePath?: string;
  line?: number;
  lines?: string[];
  error?: string;
};

const MAX_LINES = 600;

function parseLine(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function toRepoRelativePath(value: string | string[] | undefined): string {
  const raw = (Array.isArray(value) ? value[0] : value) ?? "";
  return raw.trim().replace(/^\/+/, "");
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<CodeFileResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res
      .status(405)
      .json({ ok: false, error: "Method not allowed. Use GET." });
  }

  const access = ensureInternalApiAccess(req, {
    devOnlyError: "Code file preview is only available in development",
    localhostError:
      "Code file preview requires localhost access or RUN_COVERAGE_TOKEN configuration.",
  });
  if (!access.allowed) {
    return res.status(access.status).json({ ok: false, error: access.error });
  }

  const relativePath = toRepoRelativePath(req.query.path);
  if (!relativePath) {
    return res.status(400).json({ ok: false, error: "Missing path query" });
  }

  const root = getMonorepoRoot();
  const absolute = path.resolve(root, relativePath);
  const relativeFromRoot = path.relative(root, absolute);
  const escapedRoot =
    relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot);
  if (escapedRoot) {
    return res.status(400).json({ ok: false, error: "Invalid file path" });
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolute);
  } catch {
    return res.status(404).json({ ok: false, error: "File not found" });
  }
  if (!stat.isFile()) {
    return res.status(400).json({ ok: false, error: "Path is not a file" });
  }

  const startLine = parseLine(req.query.line);
  try {
    const content = fs.readFileSync(absolute, "utf8");
    const allLines = content.split(/\r\n|\n|\r/);
    const start = Math.max(0, startLine - 1 - Math.floor(MAX_LINES / 2));
    const end = Math.min(allLines.length, start + MAX_LINES);
    const excerpt = allLines.slice(start, end);
    return res.status(200).json({
      ok: true,
      filePath: relativePath,
      line: start + 1,
      lines: excerpt,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
