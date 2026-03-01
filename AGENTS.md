# Developer Guide

Reference documentation for the RateMyUnit architecture, development workflow, and deployment procedures.

## Project Overview

**RateMyUnit** aggregates and standardizes student reviews of university subjects across Australia. It provides a centralized, searchable database of ratings, workload estimates, comments, and moderation tools.

### Product & UX Guidelines

- **Tone:** Friendly, student-focused.
- **Visual:** Neo-brutalist (bold contrast, thick borders, raw typography).
- **UX:** High feedback for every action (toasts, loading states, confirmations).
- **Responsiveness:** Mobile-first.

### Key Features

- Universal scraping engine with configurable strategies.
- Real-time search and filtering.
- Verified student authentication with moderation.
- Background job processing via BullMQ/Redis.

## Architecture

### Monorepo Layout (Turborepo)

```
ratemyunit/
├── apps/
│   ├── api/                    # Fastify backend + scrapers + scripts
│   └── web/                    # React frontend
├── packages/
│   ├── db/                     # Drizzle schema, client, migrations
│   ├── types/                  # Shared TypeScript interfaces
│   └── validators/             # Zod input schemas
├── terraform/                  # Infrastructure-as-code
├── .github/workflows/          # CI/CD
└── docker-compose.yml          # Local PostgreSQL + Redis setup
```

### Tech Stack

| Layer          | Technology                                              |
| -------------- | ------------------------------------------------------- |
| Monorepo       | Turborepo + npm workspaces                              |
| Frontend       | React 19, Vite, Tailwind CSS 4, TanStack Query          |
| Backend        | Fastify 5, BullMQ (Redis), Drizzle ORM                  |
| Database       | PostgreSQL 16 (production; local Docker uses 15-alpine) |
| Auth           | Lucia + Argon2                                          |
| Validation     | Zod                                                     |
| Infrastructure | Terraform, AWS (EC2, RDS, ECR), Cloudflare proxy        |
| CI/CD          | GitHub Actions with OIDC roles                          |

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10.8.2+
- Docker & Docker Compose

### Quick Start

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
docker-compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

**Local URLs**:

- Frontend: http://localhost:5173
- API: http://localhost:3000
- API Docs (Swagger): http://localhost:3000/documentation

Default admin: `admin@student.uts.edu.au` / `ChangeMe123!` (change immediately).

### Environment Variables

**apps/api/.env**

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://ratemyunit:devpassword@localhost:5432/ratemyunit
REDIS_URL=redis://localhost:6379
JWT_SECRET=min-32-chars
FRONTEND_URL=http://localhost:5173
SCRAPER_CONCURRENCY=1
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_NAME=RateMyUnit
RESEND_FROM_EMAIL=verify@send.ratemyunit.dev
GUEST_REVIEW_IP_HASH_SALT=replace-with-16+-char-secret
TRUSTED_PROXY_CIDRS=173.245.48.0/20,103.21.244.0/22
```

**packages/db/.env**

```env
DATABASE_URL=postgresql://ratemyunit:devpassword@localhost:5432/ratemyunit
```

## Workflow Expectations

- Prefer `npm` workspace scripts over direct `turbo` usage.
- Write tests alongside changes; maintain >80% coverage for new code.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before shipping.
- Use non-interactive commands in CI contexts.

## Database Schema Highlights

**Universities**

- Holds scraper metadata (type, routes, selectors).
- Configurable JSON columns for dynamic targets.

**Users**

- Roles: `student`, `admin`, `moderator`.
- Email verification, banning, university association.

**Units**

- Core info: code, name, faculty, description.
- Extended fields: workload, learning outcomes, delivery modes.
- Unique constraint: `(universityId, unitCode)`.

**Subject Code Templates**

- Define scanning strategies (range/list/pattern).
- UTS policy: list templates only.

## API Structure

### Route Map

| Prefix         | Purpose                      | Auth          |
| -------------- | ---------------------------- | ------------- |
| `/api/auth`    | Register/login/logout        | No            |
| `/api/public`  | Universities, units, reviews | No            |
| `/api/units`   | Unit management, search      | Authenticated |
| `/api/reviews` | CRUD reviews, votes, flags   | Authenticated |
| `/api/admin`   | Moderation, user management  | Admin only    |

Auth notes:

- `POST /api/auth/resend-verification` re-sends verification links for unverified accounts (generic success response to avoid user enumeration).

### Security

- CSRF protection via `@fastify/csrf-protection`.
- Rate limiting: 100 req/min per IP.
- CSP via Helmet.
- Production proxy trust is strict and configured via `TRUSTED_PROXY_CIDRS`; guest IP rate-limits rely on Fastify-resolved `request.ip`.
- Registration email policy (`.edu.au` enforcement) is runtime-configurable from Admin Site Banner settings and defaults to disabled.

## Scraper Architecture

### Strategy Pattern

- **BaseScraper**: Defines `scrapeSubject`.
- **Implementations**:
  - `courseloop.ts`: SPAs (UTS, Monash).
  - `generic.ts`: DOM-based parsing.
  - `search.ts`: Search/API discovery.

### Admin Controls

- Modes: single subject, bulk, range, auto-discovery.
- Queue management via BullMQ.
- Site Banner settings also manage policy toggles:
  - `Require .edu.au emails for signup` (`enforce_edu_au_email`).
  - `Allow guest reviews` (`allow_guest_reviews`).
  - `Admin moderation alert email` (`admin_alert_email`), used for per-flag alert notifications.
- Single-subject scrape retries: if a previous job is in `failed` or `completed`, the API removes that terminal job and re-queues the subject.
- Runtime diagnostics endpoint: `GET /api/admin/scrape/diagnostics`.
- Diagnostics include:
  - Browser stability counters (`crashLikeErrorsTotal`, recovery attempts/success/failure).
  - Queue enqueue counters by source (`single`, `bulk`, `range`, `discovery`).
  - Input normalization counters (duplicates removed, already indexed skipped, known already queued).
- Job ID collision **signals** are approximate and inferred from timestamp comparison (`jobIdCollisionSignalsMethod: timestamp_before_batch_start`).
- Public university lists are deduplicated by abbreviation; database now enforces unique `universities.abbreviation` to prevent duplicate entries.
- Template source policy: UTS uses one full-list template from `https://www.handbook.uts.edu.au/subjects/alpha`; UNSW uses one full-list template from course-outlines API union of years 2025 and 2026 (deduped by subject code). Use `npm run rebuild-uts-unsw-templates -w @ratemyunit/db` to refresh both.
- Guest reviews:
  - When enabled, non-authenticated users can post reviews.
  - Guest reviews are rate-limited in-app to one review per unit per IP hash every 24 hours.
  - Guest reviews are displayed as `Guest User (Not logged in)`.
  - Logged-in reviews display `(... Logged in)` unless the account has verified `.edu.au` email, in which case `(... Verified Student)` is shown.
- Review moderation queue:
  - Reviews enter queue from the first user flag (`review_flags.status = pending`), with aggregated `flagCount`.
  - Reviews are not auto-hidden by flag threshold.
  - Admin moderation actions resolve pending flags for that review.

## Infrastructure & Deployment

### AWS Setup (ap-southeast-2)

- **EC2**: t3.micro, Elastic IP.
- **RDS**: PostgreSQL 16.6, db.t3.micro, private subnets.
- **Networking**: VPC, Cloudflare IPs only.
- **Secrets**: SSM Parameter Store.

### Deployment Flow

1. **Build**: Dockerfile builds API + frontend.
2. **Push**: ECR repository `ratemyunit-api`.
3. **Deploy**: SSM Run Command updates EC2.
4. **Migrate**: Database migrations run automatically.
5. **Safety**: Pre-deploy migration is time-boxed and cancelled if it lingers, to avoid blocking subsequent SSM deployment commands.
   - Container startup uses `node /app/packages/db/dist/migrate.js` (non-interactive); avoid `drizzle-kit push` in production startup paths.

### CI/CD Workflows

- `ci.yml`: Lint, test, build on PRs.
- `deploy.yml`: Terraform apply and EC2 deployment on push to `main`.

## Code Conventions

### Imports

- Include `.js` extension for relative imports in ESM code.

```ts
import { config } from './config.js';
```

### Naming

- Files: kebab-case.
- Components/Types: PascalCase.
- Functions/variables: camelCase.
- Constants: UPPER_SNAKE_CASE.

## npm Scripts

**Root**

```bash
npm run dev        # Start all apps
npm run build      # Build all packages
npm run lint       # ESLint
npm run typecheck  # TypeScript check
npm run test       # Vitest
npm run db:migrate # Drizzle migrations
npm run db:seed    # Seed DB
```

## Testing

- **Backend**: Vitest (Node).
- **Frontend**: Vitest + Testing Library.
- **Coverage**:
  - API: Routes, middleware, services, scrapers.
  - Web: Components, hooks, utilities.

### Mocking

- Use `vi.hoisted()` for factory mocks.
- Mock Lucia session management methods.

## Common Workflows

1. **Add API Route**
   - Create route in `apps/api/src/routes/`.
   - Register in `app.ts`.
   - Use Zod validators.

2. **Update Schema**
   - Modify `packages/db/src/schema.ts`.
   - Run `npm run db:migrate`.
   - Update `packages/types` if needed.

3. **New Scraper**
   - Add strategy in `apps/api/src/scrapers/strategies/`.
   - Update `ScraperFactory`.

4. **Infrastructure Changes**
   - Update Terraform in `/terraform/`.
   - Verify Free Tier compliance.

## Troubleshooting

- **Database**: Check Docker/RDS status and `DATABASE_URL`.
- **Type Errors**: Run `npm run build` to update workspace types.
- **Redis**: Check connection string and container status.
- **Windows**: Install `@rollup/rollup-win32-x64-msvc` if missing.
