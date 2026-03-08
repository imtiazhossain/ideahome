#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

echo "[dev] Restarting backend..."
bash "$ROOT_DIR/scripts/restart-backend.sh"

echo "[dev] Restarting web..."
bash "$ROOT_DIR/scripts/restart-web.sh"

echo "[dev] Restart complete."
echo "[dev] Backend log: /tmp/ideahome-backend.log"
echo "[dev] Web log: /tmp/ideahome-web.log"
