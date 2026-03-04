#!/usr/bin/env bash
set -euo pipefail

if [[ "${VERCEL_RUN_MIGRATIONS:-0}" != "1" ]]; then
  echo "Skipping prisma migrate deploy (set VERCEL_RUN_MIGRATIONS=1 to enable during build)."
  exit 0
fi

attempts="${PRISMA_MIGRATE_ATTEMPTS:-5}"
delay_seconds="${PRISMA_MIGRATE_RETRY_DELAY_SEC:-5}"
attempt=1

echo "Running prisma migrate deploy with retry (attempts=${attempts}, delay=${delay_seconds}s)."

while [[ "${attempt}" -le "${attempts}" ]]; do
  if pnpm --filter backend exec prisma migrate deploy; then
    echo "Prisma migrate deploy succeeded."
    exit 0
  fi

  if [[ "${attempt}" -ge "${attempts}" ]]; then
    echo "Prisma migrate deploy failed after ${attempts} attempts."
    exit 1
  fi

  echo "Attempt ${attempt}/${attempts} failed. Retrying in ${delay_seconds}s..."
  sleep "${delay_seconds}"
  attempt=$((attempt + 1))
done
