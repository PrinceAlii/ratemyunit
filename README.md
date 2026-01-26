# RateMyUnit

RateMyUnit is an open-source platform designed to aggregate and standardize student reviews for university subjects across Australia. It aims to solve the problem of fragmented feedback by providing a centralized, searchable database of subject ratings, workload estimates, and qualitative reviews.

The platform is built to be scalable and agnostic, supporting multiple universities through a configurable scraping engine that adapts to different handbook architectures (CourseLoop, Akari, legacy HTML).

## Tech Stack

**Core**
- **Runtime:** Node.js (TypeScript)
- **Monorepo:** Turborepo
- **Package Manager:** PNPM

**Frontend (`apps/web`)**
- React 18
- Vite
- Tailwind CSS (Neo-brutalist design system)
- TanStack Query

**Backend (`apps/api`)**
- Fastify
- BullMQ (Redis-backed job queue)
- Playwright (Headless scraping)
- Zod (Validation)

**Data (`packages/db`)**
- PostgreSQL
- Drizzle ORM
- Lucia Auth

## Architecture

The system uses a strategy-based scraping architecture. Instead of hardcoded parsers for every university, it utilizes a database-driven configuration to select the appropriate scraping strategy:

- **CourseLoop Strategy:** For modern SPAs used by universities like UTS and Monash.
- **Generic DOM Strategy:** For standard server-rendered handbooks.
- **Search-First Strategy:** For sites that obscure direct linking, utilizing an automated search-and-scrape workflow.

Job processing is handled asynchronously via Redis queues, allowing for bulk data ingestion and auto-discovery of new subjects without impacting API performance.

## Local Development

### Prerequisites
- Node.js 20+
- PNPM (`npm i -g pnpm`)
- Docker & Docker Compose

### Setup Guide

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-org/ratemyunit.git
   cd ratemyunit
   pnpm install
   ```

2. **Environment Configuration**
   Copy the example environment files and configure them. You typically only need to set the database URL and session secrets.
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp packages/db/.env.example packages/db/.env
   ```

3. **Infrastructure**
   Start the PostgreSQL and Redis containers.
   ```bash
   docker-compose up -d
   ```

4. **Database Initialization**
   Run migrations to set up the schema, then seed the database with university configurations and the default admin account.
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. **Start Development Server**
   This will launch both the API and Web apps in watch mode.
   ```bash
   pnpm dev
   ```

   - Frontend: http://localhost:5173
   - API: http://localhost:3000

## Scraper Usage

Access the scraper interface via the Admin Dashboard. The system comes pre-configured with support for major Australian universities (UTS, Monash, USYD, UNSW, UQ, UWA, etc.).

- **Single Scrape:** Enter a specific subject code to fetch immediately.
- **Auto-Discovery:** Use the "Scan" feature to crawl a university's handbook and populate the database with found units automatically.

## Contributing

We welcome contributions, especially for improving scraper selectors or adding support for new institutions. Please ensure you run type checks before submitting a PR.

```bash
pnpm typecheck
```

## License

MIT