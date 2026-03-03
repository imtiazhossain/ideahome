#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="/tmp/ideahome-web.log"
PID_FILE="/tmp/ideahome-web.pid"

cd "$ROOT_DIR"

echo "[web] Stopping existing web processes..."
PIDS="$(
  ps aux \
    | rg "$ROOT_DIR" \
    | rg "pnpm --filter web dev|web/node_modules/.bin/.*/next|next/dist/bin/next dev -H 0.0.0.0" \
    | rg -v "rg " \
    | awk '{print $2}' \
    | sort -u \
    | xargs 2>/dev/null || true
)"

if [[ -n "${PIDS:-}" ]]; then
  kill $PIDS || true
  sleep 1
fi

PIDS_LEFT="$(
  ps aux \
    | rg "$ROOT_DIR" \
    | rg "pnpm --filter web dev|web/node_modules/.bin/.*/next|next/dist/bin/next dev -H 0.0.0.0" \
    | rg -v "rg " \
    | awk '{print $2}' \
    | sort -u \
    | xargs 2>/dev/null || true
)"
if [[ -n "${PIDS_LEFT:-}" ]]; then
  kill -9 $PIDS_LEFT || true
fi

echo "[web] Starting fresh web dev server..."
nohup pnpm --filter web dev > "$LOG_FILE" 2>&1 &
LAUNCHER_PID=$!
printf '%s\n' "$LAUNCHER_PID" > "$PID_FILE"

for _ in {1..30}; do
  if lsof -iTCP:3000 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if lsof -iTCP:3000 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  LISTENER_PID="$(lsof -t -iTCP:3000 -sTCP:LISTEN -n -P | head -n1)"
  STATUS_CODE="$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/tests || true)"
  echo "[web] Running. launcher_pid=$LAUNCHER_PID listener_pid=${LISTENER_PID:-unknown} http_status=${STATUS_CODE:-n/a}"
  echo "[web] Log: $LOG_FILE"
  exit 0
fi

echo "[web] Failed to start within timeout. Last log lines:"
tail -n 60 "$LOG_FILE" || true
exit 1
