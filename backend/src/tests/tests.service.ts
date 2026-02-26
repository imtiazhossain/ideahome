import { Injectable, Logger } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as os from "os";
import * as path from "path";
import { Observable } from "rxjs";

const WORKSPACE_ROOT =
  process.env.RUN_E2E_WORKSPACE_ROOT || path.resolve(process.cwd(), "..");
const WEB_DIR = path.join(WORKSPACE_ROOT, "web");
const BACKEND_DIR = process.cwd();
const RUN_TIMEOUT_MS = 120_000;
const API_TEST_TIMEOUT_MS = 60_000;
const MAX_TEST_PATTERN_LENGTH = 300;

/** Env for child processes: no color (clean output), no NO_COLOR to avoid Node warning when FORCE_COLOR is set. */
function childEnv(): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = {
    ...process.env,
    FORCE_COLOR: "0",
  };
  delete env.NO_COLOR;
  return env;
}

/** Env for Playwright: same as childEnv but force TTY so list reporter prints test.step() lines. */
function playwrightEnv(): NodeJS.ProcessEnv {
  const env = childEnv();
  env.PLAYWRIGHT_FORCE_TTY = "1";
  env.COLUMNS = "200";
  return env;
}

/** Recursively find the first .webm file under dir. */
async function findFirstWebm(dir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const found = await findFirstWebm(full);
        if (found) return found;
      } else if (e.name.endsWith(".webm")) return full;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Flatten steps from Playwright JSON report (includes nested steps). */
function extractStepsFromReport(reportPath: string): RunUiTestStep[] {
  try {
    const content = fsSync.readFileSync(reportPath, "utf8");
    const report = JSON.parse(content) as {
      suites?: Array<{
        specs?: Array<{
          tests?: Array<{
            results?: Array<{
              steps?: Array<{
                title: string;
                duration?: number;
                steps?: Array<unknown>;
              }>;
            }>;
          }>;
        }>;
      }>;
    };
    const out: RunUiTestStep[] = [];
    function flatten(
      steps:
        | Array<{ title: string; duration?: number; steps?: Array<unknown> }>
        | undefined
    ) {
      if (!steps) return;
      for (const s of steps) {
        out.push({ title: s.title, duration: s.duration });
        flatten(
          s.steps as
            | Array<{
                title: string;
                duration?: number;
                steps?: Array<unknown>;
              }>
            | undefined
        );
      }
    }
    for (const suite of report.suites ?? []) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          for (const result of test.results ?? []) {
            if (result.steps?.length) {
              flatten(result.steps);
              return out;
            }
          }
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

export type RunUiTestStep = { title: string; duration?: number };

export type RunUiTestResult = {
  success: boolean;
  exitCode: number | null;
  output: string;
  errorOutput: string;
  /** Steps from test.step() (from Playwright JSON report when available). */
  steps?: RunUiTestStep[];
  /** Number of screenshot frames sent during run-ui-stream (for debugging). */
  screenshotCount?: number;
  /** Base64-encoded WebM video of the test run (when video recording is enabled). */
  videoBase64?: string;
};

export type RunApiTestResult = {
  success: boolean;
  exitCode: number | null;
  output: string;
  errorOutput: string;
};

export type StreamEvent =
  | { type: "screenshot"; data: string }
  | { type: "log"; data: string }
  | { type: "result"; data: RunUiTestResult }
  | { type: "error"; data: string };

function normalizePattern(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

@Injectable()
export class TestsService {
  private readonly logger = new Logger(TestsService.name);

  /**
   * Run UI test with video recording; stream log output via SSE, then send result with video.
   */
  runUiTestStream(grep: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      let child: ReturnType<typeof spawn> | null = null;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];
      let configPath: string | null = null;
      const outputDir = path.join(
        os.tmpdir(),
        `playwright-video-${Date.now()}`
      );

      const cleanup = () => {
        if (child) {
          child.kill("SIGTERM");
          child = null;
        }
        if (timeout) clearTimeout(timeout);
        timeout = null;
        if (configPath) {
          fs.unlink(configPath).catch(() => {});
          configPath = null;
        }
      };

      (async () => {
        try {
          const trimmed = normalizePattern(grep);
          if (!trimmed) {
            subscriber.next({
              data: JSON.stringify({ type: "error", data: "Missing grep" }),
            } as MessageEvent);
            subscriber.complete();
            return;
          }
          if (trimmed.length > MAX_TEST_PATTERN_LENGTH) {
            subscriber.next({
              data: JSON.stringify({
                type: "error",
                data: `grep exceeds ${MAX_TEST_PATTERN_LENGTH} characters`,
              }),
            } as MessageEvent);
            subscriber.complete();
            return;
          }

          const reportJsonPath = path.join(outputDir, "report.json");
          const config = {
            testDir: path.join(WEB_DIR, "e2e"),
            outputDir,
            reporter: [
              ["list", { printSteps: true }],
              ["json", { outputFile: reportJsonPath }],
            ],
            use: {
              baseURL:
                process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
              video: "on",
            },
            projects: [{ name: "chromium", use: { browserName: "chromium" } }],
          };
          configPath = path.join(
            os.tmpdir(),
            `playwright-stream-${Date.now()}.json`
          );
          await fs.writeFile(configPath, JSON.stringify(config), "utf8");

          child = spawn(
            "pnpm",
            [
              "exec",
              "playwright",
              "test",
              "--config",
              configPath,
              "-g",
              trimmed,
            ],
            { cwd: WEB_DIR, env: playwrightEnv() }
          );

          child.stdout?.on("data", (data: Buffer) => {
            chunks.push(data);
            subscriber.next({
              data: JSON.stringify({
                type: "log",
                data: data.toString("utf8"),
              }),
            } as MessageEvent);
          });
          child.stderr?.on("data", (data: Buffer) => {
            errChunks.push(data);
            subscriber.next({
              data: JSON.stringify({
                type: "log",
                data: data.toString("utf8"),
              }),
            } as MessageEvent);
          });

          timeout = setTimeout(
            /* istanbul ignore next */ () => {
              /* istanbul ignore next */ if (child) child.kill("SIGTERM");
            },
            RUN_TIMEOUT_MS
          );

          child.on("close", async (code, signal) => {
            cleanup();
            const output = Buffer.concat(chunks).toString("utf8");
            const errorOutput = Buffer.concat(errChunks).toString("utf8");
            let videoBase64: string | undefined;
            try {
              const videoPath = await findFirstWebm(outputDir);
              if (videoPath) {
                const buf = await fs.readFile(videoPath);
                videoBase64 = buf.toString("base64");
                this.logger.log(
                  "Attached video to result (" + buf.length + " bytes)"
                );
              }
            } catch (e) {
              this.logger.warn(
                "Could not read video: " +
                  (e instanceof Error ? e.message : String(e))
              );
            }
            let steps: RunUiTestStep[] = [];
            try {
              steps = extractStepsFromReport(
                path.join(outputDir, "report.json")
              );
            } catch {
              // ignore
            }
            try {
              await fs.rm(outputDir, { recursive: true, force: true });
            } catch {
              // ignore
            }
            const result: RunUiTestResult = {
              success: code === 0,
              exitCode: code,
              output,
              errorOutput: signal
                ? errorOutput + `\n[Process ${signal}]`
                : errorOutput,
              steps: steps.length ? steps : undefined,
              videoBase64,
            };
            subscriber.next({
              data: JSON.stringify({ type: "result", data: result }),
            } as MessageEvent);
            subscriber.complete();
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          subscriber.next({
            data: JSON.stringify({ type: "error", data: msg }),
          } as MessageEvent);
          cleanup();
          subscriber.complete();
        }
      })();

      return () => cleanup();
    });
  }

  async runUiTest(grep: string): Promise<RunUiTestResult> {
    const pattern = normalizePattern(grep);
    if (!pattern) {
      return {
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: "Missing grep",
      };
    }
    if (pattern.length > MAX_TEST_PATTERN_LENGTH) {
      return {
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: `grep exceeds ${MAX_TEST_PATTERN_LENGTH} characters`,
      };
    }
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    const outputDir = path.join(os.tmpdir(), `playwright-video-${Date.now()}`);
    const defaultTestResultsDir = path.join(WEB_DIR, "test-results");
    let configPath: string | null = null;

    return new Promise((resolve) => {
      let settled = false;
      const finish = async (
        code: number | null,
        signal: string | null,
        timedOut: boolean
      ) => {
        if (settled) return;
        settled = true;
        const output = Buffer.concat(chunks).toString("utf8");
        const errorOutput =
          Buffer.concat(errChunks).toString("utf8") +
          (timedOut ? `\n[Timed out after ${RUN_TIMEOUT_MS / 1000}s]` : "") +
          (signal ? `\n[Process ${signal}]` : "");

        let videoBase64: string | undefined;
        try {
          // Give Playwright a moment to flush and close the video file
          await new Promise((r) => setTimeout(r, 800));
          let videoPath = await findFirstWebm(outputDir);
          if (!videoPath) {
            videoPath = await findFirstWebm(defaultTestResultsDir);
          }
          if (videoPath) {
            const buf = await fs.readFile(videoPath);
            videoBase64 = buf.toString("base64");
            this.logger.log(
              "Attached video to runUiTest result (" + buf.length + " bytes)"
            );
          }
        } catch (e) {
          this.logger.warn(
            "Could not read video: " +
              (e instanceof Error ? e.message : String(e))
          );
        }
        let steps: RunUiTestStep[] = [];
        try {
          steps = extractStepsFromReport(path.join(outputDir, "report.json"));
        } catch {
          // ignore
        }
        try {
          await fs.rm(outputDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
        if (configPath) {
          fs.unlink(configPath).catch(() => {});
        }

        resolve({
          success: code === 0,
          exitCode: code,
          output,
          errorOutput,
          steps: steps.length ? steps : undefined,
          videoBase64,
        });
      };

      (async () => {
        try {
          await fs.mkdir(outputDir, { recursive: true });
          const reportJsonPath = path.join(outputDir, "report.json");
          const config = {
            testDir: path.join(WEB_DIR, "e2e"),
            outputDir: path.resolve(outputDir),
            reporter: [
              ["list", { printSteps: true }],
              ["json", { outputFile: reportJsonPath }],
            ],
            use: {
              baseURL:
                process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
              video: "on",
            },
            projects: [{ name: "chromium", use: { browserName: "chromium" } }],
          };
          configPath = path.join(
            os.tmpdir(),
            `playwright-run-${Date.now()}.json`
          );
          await fs.writeFile(configPath, JSON.stringify(config), "utf8");
        } catch (e) {
          resolve({
            success: false,
            exitCode: null,
            output: "",
            errorOutput:
              "Failed to write config: " +
              (e instanceof Error ? e.message : String(e)),
          });
          return;
        }

        const child = spawn(
          "pnpm",
          [
            "exec",
            "playwright",
            "test",
            "--config",
            configPath!,
            "--output",
            outputDir,
            "-g",
            pattern,
          ],
          { cwd: WEB_DIR, env: playwrightEnv() }
        );

        child.stdout?.on("data", (data: Buffer) => chunks.push(data));
        child.stderr?.on("data", (data: Buffer) => errChunks.push(data));

        const timeout = setTimeout(
          /* istanbul ignore next */ () => {
            /* istanbul ignore next */ child.kill("SIGTERM");
            /* istanbul ignore next */ void finish(null, null, true);
          },
          RUN_TIMEOUT_MS
        );

        child.on("close", (code, signal) => {
          clearTimeout(timeout);
          void finish(code, signal, false);
        });
      })();
    });
  }

  /**
   * Run a single API (Jest e2e) test by name pattern.
   */
  async runApiTest(testNamePattern: string): Promise<RunApiTestResult> {
    const pattern = normalizePattern(testNamePattern);
    if (!pattern) {
      return {
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: "Missing test name pattern",
      };
    }
    if (pattern.length > MAX_TEST_PATTERN_LENGTH) {
      return {
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: `test name pattern exceeds ${MAX_TEST_PATTERN_LENGTH} characters`,
      };
    }

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    return new Promise((resolve) => {
      const child = spawn(
        "pnpm",
        [
          "exec",
          "jest",
          "--config",
          "./test/jest-e2e.json",
          "--testNamePattern",
          pattern,
          "--silent",
          "--no-cache",
        ],
        {
          cwd: BACKEND_DIR,
          env: childEnv(),
        }
      );

      child.stdout?.on("data", (data: Buffer) => chunks.push(data));
      child.stderr?.on("data", (data: Buffer) => errChunks.push(data));

      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        resolve({
          success: false,
          exitCode: null,
          output: Buffer.concat(chunks).toString("utf8"),
          errorOutput:
            Buffer.concat(errChunks).toString("utf8") +
            "\n[Timed out after " +
            API_TEST_TIMEOUT_MS / 1000 +
            "s]",
        });
      }, API_TEST_TIMEOUT_MS);

      child.on("close", (code, signal) => {
        clearTimeout(timeout);
        const output = Buffer.concat(chunks).toString("utf8");
        const errorOutput = Buffer.concat(errChunks).toString("utf8");
        resolve({
          success: code === 0,
          exitCode: code,
          output,
          errorOutput: signal
            ? errorOutput + `\n[Process ${signal}]`
            : errorOutput,
        });
      });
    });
  }
}
