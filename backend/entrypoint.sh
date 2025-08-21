#!/usr/bin/env bash
set -euo pipefail

# Wait for Postgres to be ready
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

echo "Waiting for database to be ready..."
ATTEMPTS=30
SLEEP=2
for i in $(seq 1 $ATTEMPTS); do
  if npx prisma db execute --stdin <<<'-- ping' >/dev/null 2>&1; then
    echo "Database is reachable."
    break
  fi
  echo "[$i/$ATTEMPTS] DB not ready yet; retrying in ${SLEEP}s..."
  sleep $SLEEP
  if [ "$i" = "$ATTEMPTS" ]; then
    echo "Database did not become ready in time" >&2
    exit 1
  fi
done

# Apply migrations (idempotent)
echo "Applying Prisma migrations..."
if ! npx prisma migrate deploy; then
  echo "Migration deploy failed, retrying in 5s..."
  sleep 5
  npx prisma migrate deploy || echo "Migrations could not be applied; continuing..."
fi

# Ensure DB schema matches the current Prisma schema (for cases where migrations lag behind)
if [ "${PRISMA_DB_PUSH_AFTER_DEPLOY:-true}" != "false" ]; then
  echo "Syncing schema with 'prisma db push' to catch any drift..."
  npx prisma db push || true
fi

# If there are no migrations in the repo, ensure schema is applied (useful for first run/dev)
if [ ! -d "prisma/migrations" ] || [ -z "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "No migrations found; syncing schema with 'prisma db push'..."
  npx prisma db push
fi

# Generate client (safe to re-run)
echo "Generating Prisma client..."
npx prisma generate

# Seed data on first run (idempotent); can be disabled with SEED_ON_START=false
if [ "${SEED_ON_START:-true}" != "false" ]; then
  echo "Running seed script (idempotent)..."
  node src/scripts/seed.js || true
fi

# Start the app
echo "Starting the application..."
exec npm start
