#!/usr/bin/env sh
# Retry prisma migrate deploy (Render free-tier DB may be slow to wake or resume)
set -e
max=8
n=0
until [ "$n" -ge "$max" ]; do
  if npx prisma migrate deploy; then
    exit 0
  fi
  n=$((n + 1))
  echo "Migration attempt $n/$max failed, retrying in 15s..."
  sleep 15
done
echo "Migration failed after $max attempts"
exit 1
