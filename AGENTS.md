# AGENTS.MD - RateMyUnit Project Guide

**IMPORTANT**: This file must be kept up-to-date. AI Agents working on this repository should update it whenever they:
- Introduce new architectural patterns or major features
- Modify deployment procedures, infrastructure, or environment requirements
- Adjust significant dependencies, scripts, or workflows
- Add new packages, apps, or services

---

## Project Overview

**RateMyUnit** is an open-source platform that aggregates and standardizes student reviews of university subjects across Australia. It provides a centralized, searchable database of ratings, workload estimates, comments, and moderation tools.

### Key Features
- Universal scraping engine with configurable strategies for diverse university handbooks
- Real-time search and filtering by subject code, name, university, and faculty
- Verified student authentication with moderation and review flagging
- Modern, responsive React UI powered by Vite + Tailwind CSS
- Background job processing via BullMQ/Redis for scalable data ingestion

---

## Architecture

### Monorepo Layout (Turborepo)
```
ratemyunit/
├── apps/
│   ├── api/                    # Fastify backend + scrapers + scripts + Dockerfile
│   └── web/                    # React frontend (Tailwind + TanStack Query)
├── packages/
│   ├── db/                     # Drizzle schema, client, migrations, seeding
│   ├── types/                  # Shared TypeScript interfaces/types
│   └── validators/             # Zod input schemas + helper exports
├── terraform/                  # Infrastructure-as-code for AWS resources
├── .github/workflows/          # CI/CD (lint/test/build/deploy)
├── docker-compose.yml          # Local PostgreSQL + Redis setup
├── turbo.json                  # Task pipeline configuration
├── package.json                # Workspace scripts
└── AGENTS.md & IMPROVEMENT.md  # Agent guidance + future roadmap
```

### Tech Stack Overview
| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + npm workspaces |
| Frontend | React 19, Vite, Tailwind CSS 4, TanStack Query, Zustand, Sonner |
| Backend | Fastify 5, BullMQ (Redis), Drizzle ORM, Playwright scrapers |
| Database | PostgreSQL 16 (Drizzle) |
| Auth | Lucia + Argon2 |
| Validation | Zod |
| Infrastructure | Terraform, AWS (EC2, RDS, ECR), Cloudflare proxy |
| CI/CD | GitHub Actions with OIDC roles |

---

## Development Setup

### Prerequisites
- Node.js 20+
- npm 10.8.2 (root `package.json` uses npm workspaces)
- Docker & Docker Compose for local Postgres + Redis

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

### Environment Variables
**apps/api/.env**
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://ratemyunit:devpassword@localhost:5432/ratemyunit
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
FRONTEND_URL=http://localhost:5173
```
**packages/db/.env**
```env
DATABASE_URL=postgresql://ratemyunit:devpassword@localhost:5432/ratemyunit
```

---

## Database Schema Highlights

**Universities**
- Holds scraper metadata (type, routes, selectors)
- Configurable JSON columns for dynamic targets

**Users**
- Roles: `student`, `admin`, `moderator`
- Email verification, banning, university association

**Units**
- Core info: code, name, faculty, description
- Extended fields for scraping: workload, learning outcomes, delivery modes
- Unique constraint: `(universityId, unitCode)`

**Reviews & Votes**
- Multi-dimensional ratings and text feedback
- Status enum: `auto-approved`, `flagged`, `removed`, `approved`
- Vote table tracks helpful/not helpful per user

**Subject Code Templates**
- Define scanning strategies (range/list/pattern)
- Prioritized and managed by admins

---

## API Structure

### Route Map
| Prefix | Purpose | Auth |
|--------|---------|------|
| `/api/auth` | Register/login/logout | No |
| `/api/public` | Universities, units, reviews (public data) | No |
| `/api/units` | Unit management, search, stats | Authenticated |
| `/api/reviews` | CRUD reviews, votes, flags | Authenticated |
| `/api/admin` | Moderation, user management | Admin only |
| `/api/admin/templates` | Subject code templates | Admin only |
| `/health` | System health check (DB + Redis) | No |

### Security
- CSRF protection via `@fastify/csrf-protection` (safe cookies)
- Rate limiting: 100 req/min per IP (allowlist 127.0.0.1)
- CSP via Helmet, Cloudflare and Google Fonts allowed
- Zod validation for every request payload

---

## Scraper Architecture

### Strategy Pattern (apps/api/src/scrapers/strategies)
- **BaseScraper** defines `scrapeSubject` + optional `discoverSubjects`
- Implementations:
  - `courseloop.ts`: SPAs with CourseLoop (UTS, Monash)
  - `generic.ts`: DOM-based parsing for legacy pages
  - `search.ts`: Sites needing search/API discovery

### UTS Reference Scraper (apps/api/src/scrapers/uts)
- `scraper.ts`: Playwright extraction
- `validator.ts`: Zod runtime validation
- `parser.ts`: Normalizes to Drizzle shape
- `index.ts`: Upserts units and templates into database

### Adding a New Scraper
1. Copy the UTS folder structure
2. Implement types/validator/scraper/parser/index
3. Hook into scraper factory if unique behavior required
4. Configure `universities.scraperRoutes/selectors` JSON

---

## Infrastructure & Deployment

### AWS Setup (ap-southeast-2)
- **EC2**: t3.micro (Free Tier), Elastic IP, user data boots Docker stack
- **RDS**: PostgreSQL 16.6, db.t3.micro, private subnets, no backups
- **Networking**: VPC with public/private subnets, Cloudflare IPs only
- **Security**: No SSH, only AWS Session Manager; Cloudflare IP range is hardcoded in `terraform/networking.tf`
- **Secrets**: Stored in SSM Parameter Store (database URL, Redis URL, JWT secret, frontend URL)
- **Container Registry**: ECR repository `ratemyunit-api`, scan on push

### Terraform (/terraform)
Files and responsibilities:
| File | Purpose |
|------|---------|
| `main.tf` | Provider and defaults |
| `backend.tf` | S3 remote state config |
| `networking.tf` | VPC, subnets, security groups |
| `ec2.tf` | IAM, EC2 instance, user data script |
| `rds.tf` | RDS instance + subnet group |
| `ecr.tf` | ECR repository |
| `secrets.tf` | SSM parameters + random passwords |
| `iam_github.tf` | GitHub OIDC roles (plan+deploy) |
| `user_data.sh` | EC2 bootstrap: Docker, Redis, CloudWatch, pull image |

### Current Serving Pattern
1. Dockerfile builds both API and frontend
2. Fastify serves static files from `apps/web/dist/` via `@fastify/static`
3. SPA fallback returns `index.html` for non-API routes
4. Container maps host port 80 → internal port 3000
5. Cloudflare proxies HTTPS traffic to EC2 public IP (static Elastic IP)

### CI/CD Workflows (.github/workflows)
- **ci.yml**: Runs on PR/push to `main`, covering lint/typecheck/test/build
- **deploy.yml**: Push to `main` triggers:
  1. Path filters for infra/backend/frontend
  2. Terraform plan/apply (via AWS_DEPLOY_ROLE IAM role)
  3. Docker build/push to ECR
  4. Deployment via SSM (stop/rm container, pull image, run)
  5. Database migrations + seeding via SSM commands

### Deployment Gotchas
1. **Cloudflare IP whitelist** is static—update `terraform/networking.tf` when Cloudflare publishes new CIDR blocks
2. **Secrets** live in SSM Parameter Store and GitHub Secrets (`AWS_DEPLOY_ROLE`). Additional secrets may be added to GitHub Secrets as needed (but avoid committing them)
3. **Migrations** run automatically on every deployment (pre & post) via SSM shell commands
4. **No SSH**: Access everything via AWS Session Manager or CI/CD SSM commands
5. **Free Tier limit**: Always maintain t3.micro (EC2) and db.t3.micro (RDS) to stay within AWS 2025/26 Free Tier

---

## Code Conventions

### Imports
- Always include `.js` extension for relative imports in ESM code
```ts
import { config } from './config.js';
```

### Naming & Style
- Files: kibab-case (e.g., `public-data.ts`, `auth-context.tsx`)
- Components/Types: PascalCase
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE for true compile-time constants
- Quote style: single quotes
- No semicolons (Prettier/ESLint enforced)
- 2-space indentation, trailing commas in multiline objects
- Avoid `any`; prefer explicit types or generics; ESLint warns on `any`

---

## npm Scripts

**Root**
```bash
npm run dev        # Start all apps (Turborun)
npm run build      # Build all packages/apps
npm run lint       # ESLint over workspaces
npm run typecheck  # TypeScript checks
npm run test       # Run Vitest tests
npm run db:migrate # Run Drizzle migrations
npm run db:seed    # Seed PostgreSQL
npm run db:studio  # Launch Drizzle Studio
```

**API** (`@ratemyunit/api`)
```bash
npm run dev
npm run build
npm run start
npm run test
npm run lint
npm run typecheck
```

**Web** (`@ratemyunit/web`)
```bash
npm run dev
npm run build
npm run preview
npm run test
npm run lint
npm run typecheck
```

---

## Testing

### Frameworks
- Backend: Vitest (Node environment)
- Frontend: Vitest + Testing Library (jsdom)

### Commands
```bash
npm test  # Runs Vitest across packages
npm run test -w @ratemyunit/api
npm run test -w @ratemyunit/web
```

### Test Locations
- Typically co-located with source files or inside `__tests__/`
- Files end with `.test.ts` / `.test.tsx`

---

## Design Principles

**Scraper Design**
1. Rate-limit to 2s between requests
2. Graceful failure—missing fields do not crash scraper
3. Validate with Zod before database writes
4. Use upserts for idempotence
5. Log context-rich errors (via Pino)

**API Design**
1. RESTful resources with standard status codes
2. Standard response shape `{ success, data?, error? }`
3. Pagination for list endpoints
4. Rate limiting to protect services
5. `/health` endpoint for monitoring dependencies

**Frontend Design**
1. Reusable UI components in `components/ui/`
2. State: Zustand for auth, TanStack Query for server data
3. Forms handled via React Hook Form + Zod resolver
4. Visual style: Tailwind utilities + intentional layout choices
5. Notifications: Sonner Toaster for success/error messaging

---

## Common Tasks for AI Agents

1. **Add API Route**
   - Create route in `apps/api/src/routes/`
   - Register in `app.ts`
   - Use Zod validators from `@ratemyunit/validators`
   - Respond with standardized payload

2. **Update Schema**
   - Modify `packages/db/src/schema.ts`
   - Run `npm run db:migrate`
   - Update `packages/types` exports if needed
   - Rebuild packages (`npm run build`)

3. **New Component**
   - Add under `apps/web/src/components/`
   - Leverage existing UI primitives (buttons, inputs)
   - Import via `@/` alias (`vite.config.ts`)

4. **New Scraper**
   - Mirror the `apps/api/src/scrapers/uts/` layout
   - Implement strategy + validator/parser
   - Add tests under `__tests__`

5. **Infrastructure Changes**
   - Update Terraform in `/terraform/`
   - Run `terraform plan` locally if possible
   - Check GitHub Actions for plan/apply
   - Always verify Free Tier compliance (t3.micro, db.t3.micro)

---

## Important Notes

1. **Module System**: All packages use ESM (`type: module`), so always append `.js` to relative imports and use `fileURLToPath` when needed.
2. **Environment Validation**: `apps/api/src/config.ts` uses Zod; misconfigured ENV variables cause startup failure.
3. **Database Migrations**: Stored in `packages/db/drizzle/`; never rewrite past snapshots.
4. **Queue Processing**: BullMQ queue defined in `apps/api/src/lib/queue.ts`; background jobs run via EC2 container.
5. **Static Assets**: API serves the built frontend (`apps/web/dist/`) and handles SPA fallback via Fastify `setNotFoundHandler`.

---

## Future Enhancements

See **IMPROVEMENT.md** for a curated list of near-future initiatives and architectural experimentation ideas.

---

## Troubleshooting

### Database Issues
- Ensure Docker Postgres container is running locally, or RDS endpoint is reachable.
- Validate `DATABASE_URL` format.
- Run migrations: `npm run db:migrate`.

### Type Errors
- Rebuild packages with `npm run build`.
- Ensure imports include `.js` extensions.

### Redis Errors
- Confirm Redis container or service is running.
- GRE (`REDIS_URL`).

### CI/CD Failure
- Check GitHub Actions logs for lint/typecheck/test failures.
- Validate IAM roles (`AWS_DEPLOY_ROLE`) and secrets.

### Infrastructure Drift
- Run `terraform plan` locally (inside `/terraform/`) or rely on `deploy.yml`.
- Ensure Cloudflare IP list is current (security group ingress depends on it).

---

## Resources
- README: Project introduction and quick start
- IMPROVEMENT.md: Roadmap and enhancement ideas
- API docs: Accessible at `/documentation`
- Drizzle Studio: `npm run db:studio`
- GitHub Actions: `ci.yml`, `deploy.yml`
- Terraform state bucket: `ratemyunit-terraform-state`
- Cloudflare zone: `ratemyunit.dev`

---

*Last updated: 2026-02-01*

Remember to update this file when you make related changes.
