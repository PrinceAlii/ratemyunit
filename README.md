# RateMyUnit

![Build Status](https://img.shields.io/github/actions/workflow/status/PrinceAlii/ratemyunit/ci.yml?branch=main) ![License](https://img.shields.io/badge/license-MIT-blue) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

RateMyUnit is an open source platform designed to aggregate and standardize student reviews for university subjects across Australia. It solves the problem of fragmented feedback by providing a centralized, searchable database of subject ratings, workload estimates, and qualitative reviews.

## Key Features

*   **Universal Scraping Engine:** Configurable strategies to scrape data from diverse university handbooks (CourseLoop, Akari, legacy HTML).
*   **Real-time Search:** Instant filtering of subjects by code, name, or university.
*   **Verified Reviews:** Student authentication and moderation tools to ensure quality feedback.
*   **Modern UI:** A fast, responsive interface built with React and Tailwind CSS.
*   **Job Queues:** robust background processing for large scale data ingestion.

## Tech Stack

This project uses a modern, type safe monorepo architecture.

*   **Monorepo:** Turborepo
*   **Package Manager:** PNPM
*   **Frontend:** React 19, Vite, Tailwind CSS, TanStack Query
*   **Backend:** Node.js, Fastify, BullMQ (Redis)
*   **Database:** PostgreSQL, Drizzle ORM
*   **Infrastructure:** Terraform, AWS (EC2, RDS, S3, CloudFront)

## Getting Started

Follow these steps to set up the project locally for development.

### Prerequisites

*   Node.js 20+
*   PNPM (`npm i -g pnpm`)
*   Docker & Docker Compose

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/PrinceAlii/ratemyunit.git
    cd ratemyunit
    ```

2.  **Install dependencies**
    ```bash
    pnpm install
    ```

3.  **Configure environment**
    Copy the example environment files. You usually only need to update `DATABASE_URL` if you change the Docker defaults.
    ```bash
    cp apps/api/.env.example apps/api/.env
    cp packages/db/.env.example packages/db/.env
    ```

4.  **Start infrastructure**
    Launch the local PostgreSQL and Redis instances.
    ```bash
    docker-compose up -d
    ```

5.  **Initialize database**
    Run migrations and seed default data (university configurations, admin account).
    ```bash
    pnpm db:migrate
    pnpm db:seed
    ```

6.  **Start development server**
    This launches both the API and Web applications in watch mode.
    ```bash
    pnpm dev
    ```
    *   Web: [http://localhost:5173](http://localhost:5173)
    *   API: [http://localhost:3000](http://localhost:3000)

## Architecture

The system uses a strategy pattern for scraping. Instead of hardcoded parsers, it selects a strategy based on the target university's architecture:

*   **CourseLoop Strategy:** For SPAs used by universities like UTS and Monash.
*   **Generic DOM Strategy:** For standard server rendered handbooks.
*   **Search First Strategy:** For sites requiring search interaction to discover content.

Job processing is handled asynchronously via Redis queues to allow bulk data ingestion without blocking the API.

## Deployment

Infrastructure and deployment are fully automated using Terraform and GitHub Actions.

### Infrastructure (AWS)
*   **Networking:** VPC with public/private subnets.
*   **Compute:** EC2 (t3.micro) for the API and background workers.
*   **Database:** RDS PostgreSQL (Free Tier friendly).
*   **Storage/CDN:** S3 and CloudFront for frontend hosting.
*   **Security:** IAM Roles with OIDC for passwordless GitHub Actions authentication.

### CI/CD Pipeline
The `ci.yml` workflow runs on every push to check linting, types, and tests.
The `deploy.yml` workflow runs on pushes to `main` and performs the following:
1.  **Infra:** Applies Terraform configuration to provision/update AWS resources.
2.  **Backend:** Builds the Docker image, pushes to ECR, and deploys to EC2 using AWS Systems Manager (SSM).
3.  **Frontend:** Builds the React app and syncs static assets to S3/CloudFront.

## Contributing

Contributions are welcome. Please ensure you run the full test suite before submitting a Pull Request.

```bash
pnpm typecheck
pnpm test
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
