# Tech Stack

## Core
- **Runtime:** Node.js (v20+)
- **Language:** TypeScript (Strict mode)
- **Monorepo Management:** Turborepo with `pnpm` workspaces

## Frontend (`apps/web`)
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS (Neo-brutalist implementation)
- **UI Components:** `shadcn/ui`
- **Data Fetching:** TanStack Query (React Query)
- **State Management:** React Context (Auth)

## Backend (`apps/api`)
- **Framework:** Fastify
- **Authentication:** Lucia v3 (Session-based, HTTP-only cookies)
- **Validation:** Zod
- **Background Jobs:** BullMQ with Redis
- **Scraping Engine:** Playwright (Headless)

## Data (`packages/db`)
- **Database:** PostgreSQL 15
- **ORM:** Drizzle ORM
- **Migration Tool:** Drizzle Kit

## Infrastructure & DevOps
- **Containerization:** Docker & Docker Compose (PostgreSQL, Redis)
- **Package Manager:** `pnpm`
- **Verification:** Vitest (Testing), `pnpm typecheck`
