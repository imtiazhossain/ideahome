/**
 * Runs a single Playwright UI test with video and verifies a .webm is captured.
 * Use: pnpm run test:e2e:one (from web/) or pnpm test:e2e:one (from root).
 * Optional: PLAYWRIGHT_BASE_URL and RUN_E2E_WORKSPACE_ROOT (for backend compat).
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const WEB_DIR = path.join(__dirname, "..");
const GREP = "home page loads with title and app bar";
const DELAY_MS = 800;

function findFirstWebm(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const found = findFirstWebm(full);
        if (found) return found;
      } else if (e.name.endsWith(".webm")) return full;
    }
  } catch (_) {}
  return null;
}

async function main() {
  const outputDir = path.join(os.tmpdir(), `playwright-verify-${Date.now()}`);
  const configPath = path.join(
    os.tmpdir(),
    `playwright-verify-config-${Date.now()}.json`
  );
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

  fs.mkdirSync(outputDir, { recursive: true });
  const config = {
    testDir: path.join(WEB_DIR, "e2e"),
    outputDir: path.resolve(outputDir),
    use: {
      baseURL,
      video: "on",
    },
    projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

  const env = { ...process.env, FORCE_COLOR: "0" };
  delete env.NO_COLOR;
  const child = spawn(
    "pnpm",
    [
      "exec",
      "playwright",
      "test",
      "--config",
      configPath,
      "--output",
      outputDir,
      "-g",
      GREP,
    ],
    { cwd: WEB_DIR, env, stdio: "inherit" }
  );

  await new Promise((resolve, reject) => {
    child.on("close", () => resolve());
    child.on("error", reject);
  });

  await new Promise((r) => setTimeout(r, DELAY_MS));

  const videoPath = findFirstWebm(outputDir);
  try {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.unlinkSync(configPath);
  } catch (_) {}

  if (videoPath) {
    console.log("OK: recording captured at", videoPath);
    process.exit(0);
  }
  console.error("FAIL: no .webm recording found in", outputDir);
  process.exit(1);
}

main();
