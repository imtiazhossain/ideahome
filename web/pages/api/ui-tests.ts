import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";
import { ensureInternalApiAccess } from "../../lib/server/internal-api-access";
import { uiTests as staticUiTests } from "../../lib/ui-tests";

export type UITestSuite = {
  name: string;
  tests: string[];
};

export type UITestFile = {
  file: string;
  suites: UITestSuite[];
};

/**
 * Discover UI tests by parsing web/e2e/*.spec.ts for test.describe("...") and test("...").
 * Returns null on any error so caller can fall back to static list.
 */
function discoverUiTestsFromE2E(): UITestFile[] | null {
  try {
    const cwd = process.cwd();
    const e2eDir = [
      path.join(cwd, "e2e"),
      path.join(cwd, "web", "e2e"),
      typeof __dirname !== "undefined"
        ? path.join(__dirname, "..", "..", "e2e")
        : "",
    ].find((dir) => dir && fs.existsSync(dir));
    if (!e2eDir) return null;

    const files = fs.readdirSync(e2eDir).filter((f) => f.endsWith(".spec.ts"));
    const result: UITestFile[] = [];

    for (const file of files.sort()) {
      const filePath = path.join(e2eDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const suites = parseSpecContent(content);
      if (suites.length > 0) {
        result.push({ file, suites });
      }
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Parse spec file content for test.describe("Suite name", () => { ... test("test name", ...).
 * Handles nested describes and extracts only top-level describe names and direct test("...") names.
 */
function parseSpecContent(content: string): UITestSuite[] {
  const suites: UITestSuite[] = [];
  // Match test.describe("Suite name", () => { ... }) - capture suite name
  const describeRe =
    /test\.describe\s*\(\s*["']([^"']+)["']\s*,\s*\(\)\s*=>\s*\{/g;

  let m: RegExpExecArray | null;
  const describeMatches: { name: string; start: number; end: number }[] = [];
  while ((m = describeRe.exec(content)) !== null) {
    const start = m.index;
    const brace = findMatchingBrace(
      content,
      start + content.slice(start).indexOf("{")
    );
    describeMatches.push({
      name: m[1],
      start,
      end: brace >= 0 ? brace : content.length,
    });
  }

  for (const desc of describeMatches) {
    const block = content.slice(desc.start, desc.end);
    const tests: string[] = [];
    const testReInBlock = /test\s*\(\s*["']([^"']+)["']\s*,\s*(?:async\s*)?\(/g;
    let tm: RegExpExecArray | null;
    while ((tm = testReInBlock.exec(block)) !== null) {
      tests.push(tm[1]);
    }
    if (tests.length > 0) {
      suites.push({ name: desc.name, tests });
    }
  }

  return suites;
}

/** Find the closing brace for an opening brace at openIndex. Returns -1 if not found. */
function findMatchingBrace(content: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < content.length; i++) {
    const c = content[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * GET /api/ui-tests
 * Returns the current automated UI tests list. Discovers tests from web/e2e/*.spec.ts
 * on every request (no caching), so the Refresh button always gets the latest from the codebase.
 * Falls back to lib/ui-tests.ts on failure.
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<UITestFile[] | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const access = ensureInternalApiAccess(req, {
    devOnlyError: "UI tests endpoint is only available in development",
    localhostError:
      "UI tests endpoint requires localhost access or RUN_COVERAGE_TOKEN configuration.",
  });
  if (!access.allowed) {
    return res.status(access.status).json({ error: access.error });
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  try {
    const discovered = discoverUiTestsFromE2E();
    if (discovered && discovered.length > 0) {
      return res.status(200).json(discovered);
    }
    // Fallback to static list.
    return res.status(200).json(staticUiTests);
  } catch (err) {
    console.error("ui-tests API:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to load UI tests",
    });
  }
}
