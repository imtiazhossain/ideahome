import type { NextApiRequest, NextApiResponse } from "next";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { ensureInternalApiAccess } from "../../lib/server/internal-api-access";
import { getMonorepoRoot } from "../../lib/server/monorepo-root";

/**
 * POST /api/run-coverage
 * Runs backend tests with coverage then copies the report to the web app.
 * Only enabled in development for security.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{
    ok: boolean;
    reportCopied?: boolean;
    output?: string;
    error?: string;
  }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const access = ensureInternalApiAccess(req, {
    devOnlyError: "Run coverage is only available in development",
    localhostError:
      "Run coverage requires localhost access or RUN_COVERAGE_TOKEN configuration.",
  });
  if (!access.allowed) {
    return res.status(access.status).json({ ok: false, error: access.error });
  }

  const root = getMonorepoRoot();
  const run = (
    cmd: string,
    args: string[],
    cwd: string = root
  ): Promise<{ stdout: string; stderr: string; code: number }> =>
    new Promise((resolve) => {
      const proc = spawn(cmd, args, { cwd });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (d) => (stdout += d.toString()));
      proc.stderr?.on("data", (d) => (stderr += d.toString()));
      proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    });
  const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const backendDir = path.join(root, "backend");
  const lines: string[] = [];
  try {
    lines.push("Running: jest --config ./jest.json --coverage (in backend/)");
    const testResult = await run(
      "pnpm",
      ["exec", "jest", "--config", "./jest.json", "--coverage"],
      backendDir
    );
    lines.push(testResult.stdout);
    if (testResult.stderr) lines.push(testResult.stderr);

    const lcovReportDir = path.join(
      backendDir,
      "src",
      "coverage",
      "lcov-report"
    );
    let reportExists = fs.existsSync(lcovReportDir);
    if (!reportExists) {
      lines.push("Waiting for coverage report files...");
      for (let i = 0; i < 20; i += 1) {
        await wait(250);
        if (fs.existsSync(lcovReportDir)) {
          reportExists = true;
          break;
        }
      }
    }

    if (reportExists) {
      lines.push("\nRunning: pnpm coverage:copy");
      const copyResult = await run("pnpm", ["coverage:copy"], root);
      lines.push(copyResult.stdout);
      if (copyResult.stderr) lines.push(copyResult.stderr);
      if (copyResult.code === 0) {
        return res.status(200).json({
          ok: testResult.code === 0,
          reportCopied: true,
          output: lines.join("\n"),
        });
      }
    }

    if (testResult.code !== 0) {
      return res.status(200).json({
        ok: false,
        reportCopied: false,
        output: lines.join("\n"),
        error: `Tests exited with code ${testResult.code}`,
      });
    }

    return res.status(200).json({
      ok: false,
      reportCopied: false,
      output: lines.join("\n"),
      error: reportExists ? "Copy failed" : "No coverage report found",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      ok: false,
      output: lines.join("\n"),
      error: message,
    });
  }
}
