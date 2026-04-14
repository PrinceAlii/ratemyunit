#!/bin/bash
set -euo pipefail

DB_WAIT_ATTEMPTS="${DB_WAIT_ATTEMPTS:-30}"
DB_WAIT_SECONDS="${DB_WAIT_SECONDS:-2}"
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-false}"
AUTO_SEED="${AUTO_SEED:-false}"
FIRST_DEPLOY="${FIRST_DEPLOY:-false}"

echo "🚀 RateMyUnit API - Starting..."
echo ""

# Wait for database to be ready
echo "⏳ Waiting for database..."
for attempt in $(seq 1 "$DB_WAIT_ATTEMPTS"); do
  if psql "$DATABASE_URL" -c '\q' >/dev/null 2>&1; then
    break
  fi

  echo "   Database connection failed (attempt ${attempt}/${DB_WAIT_ATTEMPTS})"

  if [ "$attempt" -eq "$DB_WAIT_ATTEMPTS" ]; then
    echo "   ❌ Unable to connect to PostgreSQL using DATABASE_URL after ${DB_WAIT_ATTEMPTS} attempts"
    echo "   Check the configured database password and host reachability."
    exit 1
  fi

  sleep "$DB_WAIT_SECONDS"
done
echo "   ✅ Database is ready"
echo ""

# Run migrations (skip if SKIP_MIGRATIONS=true for one-off commands)
if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo "📦 Running database migrations..."
  if [ -f /app/packages/db/dist/migrate.js ]; then
    if node /app/packages/db/dist/migrate.js; then
      echo "   ✅ Migrations applied successfully"
    else
      echo "   ⚠️  Warning: Migration issues (may be expected)"
    fi
  elif [ -f /app/packages/db/scripts/apply-migrations.mjs ]; then
    # Fallback for environments where dist assets are unavailable.
    if node /app/packages/db/scripts/apply-migrations.mjs; then
      echo "   ✅ Migrations applied successfully"
    else
      echo "   ⚠️  Warning: Migration issues (may be expected)"
    fi
  else
    echo "   ⚠️  Warning: No migration runner found, skipping"
  fi
  echo ""
fi

# Run seeds (only if AUTO_SEED=true or on first deploy)
if [ "$AUTO_SEED" = "true" ] || [ "$FIRST_DEPLOY" = "true" ]; then
  echo "🌱 Running database seeds..."
  if bash /app/packages/db/scripts/seed.sh; then
    echo "   ✅ Seeding completed"
  else
    echo "   ⚠️  Warning: Seeding issues (may be expected if already seeded)"
  fi
  echo ""
fi

# If command arguments provided, run them instead of starting the API
if [ $# -gt 0 ]; then
  echo "🔧 Running custom command: $@"
  echo ""
  cd /app
  exec "$@"
fi

# Start the application
echo "🎯 Starting API server..."
echo ""
cd /app
exec node apps/api/dist/index.js
