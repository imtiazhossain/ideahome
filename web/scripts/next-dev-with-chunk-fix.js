#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const cwd = process.cwd();
const distDir = (process.env.NEXT_DIST_DIR || ".next").trim() || ".next";
const serverDir = path.join(cwd, distDir, "server");
const chunksDir = path.join(serverDir, "chunks");
const vendorDir = path.join(serverDir, "vendor-chunks");
const vendorLinkInChunks = path.join(chunksDir, "vendor-chunks");
const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");

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

const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  cwd,
  stdio: "inherit",
  env: process.env,
});

const ticker = setInterval(ensureVendorChunkLink, 250);
ensureVendorChunkLink();

const shutdown = (code) => {
  clearInterval(ticker);
  process.exit(code);
};

child.on("error", () => shutdown(1));
child.on("exit", (code) => shutdown(code ?? 0));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

