#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/tmp/ideahome-web.log"
PID_FILE="/tmp/ideahome-web.pid"

if lsof -iTCP:3000 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  LISTENER_PID="$(lsof -t -iTCP:3000 -sTCP:LISTEN -n -P | head -n1)"
  HTTP_CODE="$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/tests || true)"
  echo "[web] UP listener_pid=${LISTENER_PID:-unknown} http_status=${HTTP_CODE:-n/a}"
else
  echo "[web] DOWN (nothing listening on :3000)"
fi

if [[ -f "$PID_FILE" ]]; then
  echo "[web] launcher_pid_file=$(cat "$PID_FILE")"
fi

if [[ -f "$LOG_FILE" ]]; then
  echo "[web] tail $LOG_FILE"
  tail -n 20 "$LOG_FILE"
else
  echo "[web] log file not found: $LOG_FILE"
fi
