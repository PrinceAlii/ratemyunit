#!/bin/bash
set -e

# Database seeding script
# Runs all SQL seed files in order

echo "🌱 Starting database seeding..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

# Directory containing seed files
SEED_DIR="$(dirname "$0")/../seeds"

# Check if seed directory exists
if [ ! -d "$SEED_DIR" ]; then
  echo "❌ ERROR: Seed directory not found: $SEED_DIR"
  exit 1
fi

# Run each seed file in order
for seed_file in "$SEED_DIR"/*.sql; do
  if [ -f "$seed_file" ]; then
    filename=$(basename "$seed_file")
    echo "📄 Running: $filename"

    if psql "$DATABASE_URL" -f "$seed_file" > /dev/null 2>&1; then
      echo "   ✅ Success"
    else
      echo "   ⚠️  Warning: Failed to run $filename (may be expected if already seeded)"
    fi
    echo ""
  fi
done

echo "✅ Database seeding completed!"
echo ""
echo "📊 Database Summary:"
psql "$DATABASE_URL" -c "
SELECT
  (SELECT COUNT(*) FROM universities) as universities,
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM units) as units,
  (SELECT COUNT(*) FROM reviews) as reviews;
"
