# Deployment Guide

## Overview

RateMyUnit deploys a single ARM64 application image to an ARM Graviton EC2 instance. PostgreSQL and Redis run as local containers on that same host, while the GitHub Actions deployment job builds the image, pushes it to ECR, renders a shared runtime env file on EC2, and starts the app container.

## Architecture

- **Host**: AWS EC2 `t4g.small` running Amazon Linux 2023 (`arm64`).
- **Database**: Local PostgreSQL container with persistent Docker volume.
- **Cache/Jobs**: Local Redis container with persistent Docker volume.
- **API + Frontend**: Single ARM64 Docker image served by the API container.
- **Migrations**: Automatic on app container start via the entrypoint.
- **Seeds**: Automatic only when the deploy marks the app as a first deploy.
- **Entrypoint**: Handles database wait, migrations, optional seeding, and app startup.

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

## Deployment Flow

Committing to `main` triggers the deployment workflow:

1. Build the app image on `ubuntu-24.04-arm`.
2. Push `linux/arm64` image tags to ECR.
3. Verify the pushed manifest includes `linux/arm64`.
4. Render `/etc/ratemyunit/runtime.env` on EC2 from SSM parameters.
5. Ensure local PostgreSQL and Redis containers are running.
6. Start the app container with the shared env file.
7. Run `/health` from inside the EC2 host and fail fast with container diagnostics if it never becomes healthy.

## Manual Operations

### Run Seeds Manually

```bash
sudo docker exec -it ratemyunit-api bash /app/packages/db/scripts/seed.sh
```

### Run Migrations Only

```bash
sudo docker exec -it ratemyunit-api node /app/packages/db/dist/migrate.js
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

The app still consumes `DATABASE_URL`, but EC2 derives it locally from the SSM database password plus the fixed host topology (`postgres:5432/ratemyunit`). The full URL is no longer treated as a stored secret.

| Variable                     | Required | Source                                             |
| ---------------------------- | -------- | -------------------------------------------------- |
| `DATABASE_URL`               | Yes      | Derived on EC2 from `/ratemyunit/production/database/password` |
| `REDIS_URL`                  | Yes      | `/ratemyunit/production/redis/url`                 |
| `JWT_SECRET`                 | Yes      | `/ratemyunit/production/jwt/secret`                |
| `FRONTEND_URL`               | Yes      | `/ratemyunit/production/frontend/url`              |
| `GUEST_REVIEW_IP_HASH_SALT`  | Yes      | `/ratemyunit/production/security/guest_review_ip_hash_salt` |
| `TRUSTED_PROXY_CIDRS`        | Yes      | `/ratemyunit/production/network/trusted_proxy_cidrs` |
| `RESEND_API_KEY`             | No       | `/ratemyunit/production/resend/api_key`            |
| `RESEND_FROM_NAME`           | No       | `/ratemyunit/production/resend/from_name`          |
| `RESEND_FROM_EMAIL`          | No       | `/ratemyunit/production/resend/from_email`         |

## Troubleshooting

### Configuration Validation

If "Configuration validation failed" occurs, check SSM parameters:

1. **JWT_SECRET**: Must be 32+ characters.
2. **DATABASE_URL**: Derived locally, including URL-encoding for reserved password characters.
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
2. Keep the EC2 runtime env sourced only from SSM plus the host-local DB topology.
3. Monitor logs during deployment.
4. Change default admin password immediately.
