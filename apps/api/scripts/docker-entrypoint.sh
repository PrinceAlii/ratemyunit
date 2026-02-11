#!/bin/bash
set -e

echo "🚀 RateMyUnit API - Starting..."
echo ""

# Wait for database to be ready
echo "⏳ Waiting for database..."
until psql "$DATABASE_URL" -c '\q' 2>/dev/null; do
  echo "   Database is unavailable - sleeping"
  sleep 2
done
echo "   ✅ Database is ready"
echo ""

# Run migrations (skip if SKIP_MIGRATIONS=true for one-off commands)
if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo "📦 Running database migrations..."
  cd /app/packages/db
  if npx drizzle-kit push --force; then
    echo "   ✅ Migrations applied successfully"
  else
    echo "   ⚠️  Warning: Migration issues (may be expected)"
  fi
  echo ""
fi

# Run seeds (only if AUTO_SEED=true or on first deploy)
if [ "$AUTO_SEED" = "true" ] || [ "$FIRST_DEPLOY" = "true" ]; then
  echo "🌱 Running database seeds..."
  if bash scripts/seed.sh; then
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
