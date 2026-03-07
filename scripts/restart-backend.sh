#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="/tmp/ideahome-backend.log"
PID_FILE="/tmp/ideahome-backend.pid"

cd "$ROOT_DIR"

echo "[backend] Stopping existing backend processes..."
# Find processes related to backend dev
PIDS="$(
  ps aux \
    | grep "$ROOT_DIR/backend" \
    | grep -E "pnpm --filter backend dev|ts-node-dev|src/main.ts" \
    | grep -v "grep" \
    | awk '{print $2}' \
    | sort -u \
    | xargs 2>/dev/null || true
)"

if [[ -n "${PIDS:-}" ]]; then
  echo "[backend] Killing PIDs: $PIDS"
  kill $PIDS || true
  sleep 1
fi

# Force kill if still running
PIDS_LEFT="$(
  ps aux \
    | grep "$ROOT_DIR/backend" \
    | grep -E "pnpm --filter backend dev|ts-node-dev|src/main.ts" \
    | grep -v "grep" \
    | awk '{print $2}' \
    | sort -u \
    | xargs 2>/dev/null || true
)"
if [[ -n "${PIDS_LEFT:-}" ]]; then
  echo "[backend] Force killing PIDs: $PIDS_LEFT"
  kill -9 $PIDS_LEFT || true
fi

echo "[backend] Starting fresh backend dev server..."
rm -f "$LOG_FILE"

# Start in a detached session
LAUNCHER_PID="$(
  python3 - <<PY
import subprocess
from pathlib import Path

root = Path("$ROOT_DIR")
log = Path("$LOG_FILE")
with log.open("ab", buffering=0) as f:
    p = subprocess.Popen(
        ["pnpm", "--filter", "backend", "dev"],
        cwd=str(root),
        stdin=subprocess.DEVNULL,
        stdout=f,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    print(p.pid)
PY
)"
printf '%s\n' "$LAUNCHER_PID" > "$PID_FILE"

echo "[backend] Waiting for backend to start on port 3001..."
for _ in {1..30}; do
  if lsof -iTCP:3001 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if lsof -iTCP:3001 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  LISTENER_PID="$(lsof -t -iTCP:3001 -sTCP:LISTEN -n -P | head -n1)"
  printf '%s\n' "${LISTENER_PID:-$LAUNCHER_PID}" > "$PID_FILE"
  echo "[backend] Running. launcher_pid=$LAUNCHER_PID listener_pid=${LISTENER_PID:-unknown}"
  echo "[backend] Log: $LOG_FILE"
  exit 0
fi

echo "[backend] Failed to start within timeout. Last log lines:"
tail -n 60 "$LOG_FILE" || true
exit 1
