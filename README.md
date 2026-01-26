# RateMyUnit

A platform for Australian university students to rate their units/subjects.

## Tech Stack

- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS
- **Backend**: Fastify + TypeScript
- **Database**: PostgreSQL 15+ with Drizzle ORM
- **Auth**: Lucia v3
- **Job Queue**: BullMQ + Redis
- **Monorepo**: Turborepo + pnpm

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Start PostgreSQL and Redis:
```bash
docker-compose up -d
```

3. Run database migrations:
```bash
pnpm db:migrate
```

4. Seed the database:
```bash
pnpm db:seed
```

5. Start development servers:
```bash
pnpm dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- API Docs: http://localhost:3000/documentation

## Project Structure

```
ratemyunit/
├── apps/
│   ├── web/              # Vite + React frontend
│   └── api/              # Fastify backend
├── packages/
│   ├── db/               # Drizzle schema + migrations
│   ├── types/            # Shared TypeScript types
│   └── validators/       # Zod schemas
├── docker-compose.yml    # Local postgres + redis
└── turbo.json
```

## Scripts

- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all apps
- `pnpm lint` - Lint all code
- `pnpm typecheck` - Type check all TypeScript
- `pnpm test` - Run all tests
- `pnpm db:migrate` - Run database migrations
- `pnpm db:seed` - Seed database with test data
- `pnpm db:studio` - Open Drizzle Studio

## Data Scraping

RateMyUnit includes an automated web scraping system to populate the database with subject/unit data from university handbooks.

### Supported Universities

- ✅ **UTS (University of Technology Sydney)** - Fully supported
- 🚧 **Other universities** - Planned

### Quick Start

#### Via Admin Panel (Recommended)

1. Login to admin account at `/admin`
2. Navigate to "Data Scraping" tab
3. Choose scraping method:
   - **Single Subject**: Enter one subject code (e.g., "31251")
   - **Bulk Scrape**: Enter multiple comma-separated codes
   - **Range Scrape**: Scrape a range of codes (e.g., 31000-31999)

#### Programmatically

```typescript
import { scrapeUTSSubject, scrapeUTSSubjects } from './apps/api/src/scrapers/uts';

// Scrape single subject
const result = await scrapeUTSSubject('31251');

// Scrape multiple subjects with rate limiting
const bulkResult = await scrapeUTSSubjects(['31251', '31252', '31271'], {
  delayMs: 2000, // 2 second delay between requests
  continueOnError: true,
});

console.log(`Scraped ${bulkResult.successful}/${bulkResult.total} subjects`);
```

### Prerequisites for Scraping

```bash
# Install Playwright browsers
npx playwright install chromium

# Ensure Redis is running (for job queue)
docker-compose up -d redis
```

### Features

- ✅ Type-safe with Zod validation
- ✅ Rate limiting to respect servers
- ✅ Comprehensive error handling
- ✅ Background job processing with BullMQ
- ✅ Real-time progress tracking in admin UI
- ✅ Automatic database upserts
- ✅ Admin-only access control

### Documentation

- **Project Context & Developer Handbook**: `PROJECT_CONTEXT.md` (Primary resource for developers and AI agents)
- **UTS Scraper**: `apps/api/src/scrapers/uts/README.md`
- **Testing Guide**: `apps/api/docs/scraper-testing-guide.md`

### Extending to Other Universities

To add support for a new university:

1. Copy the UTS scraper template from `apps/api/src/scrapers/uts/`
2. Implement university-specific extraction logic in `scraper.ts`
3. Update validators and parsers for the university's data format
4. Add university routes to `apps/api/src/routes/admin.ts`
5. Update admin UI to include new university option
6. Test thoroughly using the testing guide

See `apps/api/src/scrapers/uts/` for a complete reference implementation.

## License

MIT
