# Deployment Guide

## Overview

RateMyUnit uses automated migrations and seeding via the `docker-entrypoint.sh` script. Database changes persist in RDS across container restarts. The GitHub Actions workflow detects first deployments and triggers seeding.

## Architecture

- **Database**: AWS RDS PostgreSQL (persistent).
- **API**: Docker container on EC2 (stateless).
- **Migrations**: Automatic on container start via entrypoint.
- **Seeds**: Automatic on first deploy or when configured.
- **Entrypoint**: Handles migrations, seeding, and startup.

## Docker Entrypoint

The `apps/api/scripts/docker-entrypoint.sh` script manages:

1. **Database Wait**: Polls PostgreSQL until ready.
2. **Migrations**: Runs `node /app/packages/db/dist/migrate.js` (unless `SKIP_MIGRATIONS=true`).
   - Fallback: `node /app/packages/db/scripts/apply-migrations.mjs` if dist assets are unavailable.
3. **Seeding**: Runs SQL seed files if `FIRST_DEPLOY=true` or `AUTO_SEED=true`.
4. **API Startup**: Starts the Node.js API server.

### Custom Commands

The entrypoint supports one-off commands:

```bash
# Run custom command (migrations run first)
docker run --rm -e DATABASE_URL=... ratemyunit-api node /app/some-script.js

# Skip migrations
docker run --rm -e SKIP_MIGRATIONS=true ratemyunit-api bash /app/some-task.sh
```

### Environment Variables

| Variable          | Default | Description                             |
| ----------------- | ------- | --------------------------------------- |
| `SKIP_MIGRATIONS` | `false` | Skip automatic migrations.              |
| `FIRST_DEPLOY`    | `false` | Trigger seeding for initial deployment. |
| `AUTO_SEED`       | `false` | Run seeds on every container start.     |

## Initial Setup

### 1. Build and Push Image

Committing to `main` triggers the CI/CD pipeline:

- Builds Docker image.
- Pushes to ECR.
- Deploys to EC2.

### 2. Deploy

The GitHub Actions workflow automates the process:

1. Detects first deployment (no existing container).
2. Sets `FIRST_DEPLOY=true` if needed.
3. Validates SSM parameters (DATABASE_URL, JWT_SECRET).
4. Deploys container with environment variables.
5. Runs migrations and seeds automatically.

**Manual Deployment (SSM):**

```bash
aws ssm start-session --target i-07fb1dfd6a663367d

sudo docker-compose pull api
sudo docker-compose up -d api
```

## Manual Operations

### Run Seeds Manually

```bash
# From container
sudo docker exec -it ratemyunit-api bash /app/packages/db/scripts/seed.sh

# Or set environment variable and restart
sudo AUTO_SEED=true docker-compose up -d api
```

### Run Migrations Only

```bash
sudo docker exec -it ratemyunit-api node /app/packages/db/dist/migrate.js
# Fallback:
sudo docker exec -it ratemyunit-api node /app/packages/db/scripts/apply-migrations.mjs
```

### Check Database Status

```bash
sudo docker exec ratemyunit-api psql $DATABASE_URL -c "
SELECT
  (SELECT COUNT(*) FROM universities) as universities,
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM units) as units,
  (SELECT COUNT(*) FROM reviews) as reviews;
"
```

## Seed Files

Located in `packages/db/seeds/`:

1. **001_universities.sql**: Australian universities.
2. **002_test_units.sql**: Test data (skipped if units exist).
3. **003_admin_user.sql**: Admin account (skipped if exists).

## Environment Variables

| Variable         | Required | Description       | SSM Path                                |
| ---------------- | -------- | ----------------- | --------------------------------------- |
| `DATABASE_URL`   | Yes      | Connection string | `/ratemyunit/production/database/url`   |
| `REDIS_URL`      | No       | Redis connection  | `/ratemyunit/production/redis/url`      |
| `JWT_SECRET`     | Yes      | Signing secret    | `/ratemyunit/production/jwt/secret`     |
| `FRONTEND_URL`   | No       | CORS origin       | `/ratemyunit/production/frontend/url`   |
| `RESEND_API_KEY` | Yes      | Email API key     | `/ratemyunit/production/resend/api_key` |

### FRONTEND_URL Configuration

`FRONTEND_URL` must match the production domain for CORS.

**Update Procedure:**

```bash
aws ssm put-parameter \
  --name /ratemyunit/production/frontend/url \
  --value https://ratemyunit.dev \
  --type String \
  --overwrite \
  --region ap-southeast-2

sudo docker restart ratemyunit-api
```

## Troubleshooting

### Configuration Validation

If "Configuration validation failed" occurs, check SSM parameters:

1. **JWT_SECRET**: Must be 32+ characters.
2. **DATABASE_URL**: Must be a valid `postgresql://` URI.
3. **RESEND_API_KEY**: Must start with `re_`.

### Migrations Failed

Check logs for specific errors:

```bash
sudo docker logs ratemyunit-api | grep -i "migration\|error"
```

Force migrations manually if needed.
Use the same migration runner as the container entrypoint (`dist/migrate.js` or `scripts/apply-migrations.mjs`), not `drizzle-kit push --force` in production.

### CORS Issues (400 Bad Request)

If `POST /api/auth/logout` or `DELETE` requests fail with 400:

- Verify `FRONTEND_URL` matches the browser origin.
- Check `sameSite` cookie settings.

## Best Practices

1. Test migrations locally (`npm run db:migrate`).
2. Use RDS snapshots before major updates.
3. Monitor logs during deployment.
4. Change default admin password immediately.
