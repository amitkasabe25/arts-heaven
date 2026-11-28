#!/bin/sh
# Applied by the production Docker image before the API starts.
# Set SKIP_MIGRATIONS=1 to start without touching the database (e.g. one-off jobs).
set -eu

if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] SKIP_MIGRATIONS=1 — skipping database migrations"
else
  echo "[entrypoint] applying database migrations (prisma migrate deploy)"
  npx prisma migrate deploy
fi

exec "$@"
