#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");

const cwd = process.cwd();
const distDir = (process.env.NEXT_DIST_DIR || ".next").trim() || ".next";
const serverDir = path.join(cwd, distDir, "server");
const chunksDir = path.join(serverDir, "chunks");
const vendorDir = path.join(serverDir, "vendor-chunks");
const vendorLinkInChunks = path.join(chunksDir, "vendor-chunks");
const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
const CHILD_ARGS = [nextBin, "dev", ...process.argv.slice(2)];

const SELF_HEAL_PATTERNS = [
  {
    regex: /Cannot find module '\.\/chunks\/vendor-chunks\//,
    reason: "missing vendor chunk module",
  },
  {
    regex: /ENOENT: no such file or directory, open '.*\/\.next\/server\/pages\/.*\.js'/,
    reason: "missing compiled page artifact",
  },
];
const MAX_RESTARTS_PER_WINDOW = 4;
const RESTART_WINDOW_MS = 10 * 60 * 1000;
const FORCE_KILL_AFTER_MS = 5000;

let child = null;
let shuttingDown = false;
let restartRequested = false;
let forceKillTimer = null;
const restartTimestamps = [];

function ensureVendorChunkLink() {
  if (!fs.existsSync(serverDir)) return;
  if (!fs.existsSync(vendorDir)) return;
  fs.mkdirSync(chunksDir, { recursive: true });

  try {
    const stat = fs.lstatSync(vendorLinkInChunks);
    if (stat.isSymbolicLink()) {
      const currentTarget = fs.readlinkSync(vendorLinkInChunks);
      if (currentTarget === "../vendor-chunks") return;
    }
    fs.rmSync(vendorLinkInChunks, { recursive: true, force: true });
  } catch {
    // Path does not exist yet; continue.
  }

  try {
    fs.symlinkSync("../vendor-chunks", vendorLinkInChunks, "dir");
  } catch {
    // If symlink creation fails, keep going. Next request may re-attempt.
  }
}

function pruneRestartTimestamps(nowMs) {
  while (
    restartTimestamps.length > 0 &&
    nowMs - restartTimestamps[0] > RESTART_WINDOW_MS
  ) {
    restartTimestamps.shift();
  }
}

function canRestartNow() {
  const nowMs = Date.now();
  pruneRestartTimestamps(nowMs);
  if (restartTimestamps.length >= MAX_RESTARTS_PER_WINDOW) return false;
  restartTimestamps.push(nowMs);
  return true;
}

function isoNow() {
  return new Date().toISOString();
}

function clearDistDir() {
  try {
    fs.rmSync(path.join(cwd, distDir), { recursive: true, force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `[next-dev-with-chunk-fix] failed to clear ${distDir}: ${message}\n`
    );
  }
}

function requestSelfHeal(reason) {
  if (shuttingDown || restartRequested) return;
  if (!canRestartNow()) {
    process.stderr.write(
      `[next-dev-with-chunk-fix] detected ${reason}, but restart throttled (${MAX_RESTARTS_PER_WINDOW}/${RESTART_WINDOW_MS}ms). Run scripts/restart-web.sh manually.\n`
    );
    return;
  }

  restartRequested = true;
  const restartCount = restartTimestamps.length;
  process.stderr.write(
    `[next-dev-with-chunk-fix] [${isoNow()}] AUTO-HEAL ${restartCount}/${MAX_RESTARTS_PER_WINDOW}: detected ${reason}; rebuilding ${distDir} and restarting Next dev.\n`
  );
  child.kill("SIGTERM");
  forceKillTimer = setTimeout(() => {
    if (child && !child.killed) child.kill("SIGKILL");
  }, FORCE_KILL_AFTER_MS);
}

function wireOutput(stream, destination) {
  stream.on("data", (chunk) => destination.write(chunk));
  const rl = readline.createInterface({ input: stream });
  rl.on("line", (line) => {
    for (const pattern of SELF_HEAL_PATTERNS) {
      if (pattern.regex.test(line)) {
        requestSelfHeal(pattern.reason);
        break;
      }
    }
  });
}

function startChild() {
  child = spawn(process.execPath, CHILD_ARGS, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  wireOutput(child.stdout, process.stdout);
  wireOutput(child.stderr, process.stderr);

  child.on("error", () => {
    if (shuttingDown) return;
    shutdown(1);
  });

  child.on("exit", (code) => {
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
      forceKillTimer = null;
    }

    if (shuttingDown) {
      shutdown(code ?? 0);
      return;
    }

    if (restartRequested) {
      process.stderr.write(
        `[next-dev-with-chunk-fix] [${isoNow()}] AUTO-HEAL complete: restarting Next dev process.\n`
      );
      clearDistDir();
      restartRequested = false;
      ensureVendorChunkLink();
      startChild();
      return;
    }

    shutdown(code ?? 0);
  });
}

const ticker = setInterval(ensureVendorChunkLink, 250);
ensureVendorChunkLink();
startChild();

const shutdown = (code) => {
  shuttingDown = true;
  if (forceKillTimer) {
    clearTimeout(forceKillTimer);
    forceKillTimer = null;
  }
  clearInterval(ticker);
  process.exit(code);
};

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shuttingDown = true;
    if (child) child.kill(signal);
    setTimeout(() => shutdown(0), 1000);
  });
}
