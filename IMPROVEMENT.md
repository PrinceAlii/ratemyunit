# IMPROVEMENT.md

This file documents near-future initiatives, architectural experiments, and known improvement opportunities for RateMyUnit. Keeping this list up to date helps maintain long-term clarity and ensures AI agents can contribute thoughtfully.

## Frontend & Delivery

- **CDN for static assets**: Consider serving `apps/web/dist/` from S3 + CloudFront instead of the API container. Benefits: better caching, lighter API image, faster global delivery.
- **Cache busting**: Emit predictable filenames using content hashes so Cloudflare can cache aggressively.
- **Separate frontend build pipeline**: Rather than bundling client and server together, run a dedicated `npm run build:web` + `npm run deploy:web` to keep deployments focused.

## Container / Runtime Architecture

- **Split API / Static hosting**: Run API in one container/instance and host static files either on S3 or behind Nginx. This reduces redeploy friction and isolates surface area for bugs.
- **Sidecar worker**: Consider adding a dedicated worker container for background jobs to offload scraping/data ingestion from the main API container.
- **Health monitoring**: Add a lightweight `/status` endpoint or integrate with CloudWatch alarms to detect failed deployments.

## Scraper Enhancements

- **Caching**: Store last-scraped timestamps and skip unchanged subjects to reduce load.
- **Parallel scraping**: Introduce concurrency limits via configurable queues so multiple subjects can be processed faster while respecting target site politeness.
- **Incremental updates**: Only scrape differences based on templates or course updates instead of reprocessing entire catalogs.
- **Metrics & observability**: Emit success/failure counts, durations, and target URLs to CloudWatch or an observability tool.

## Testing & Quality

- **E2E coverage**: Add Playwright or Cypress tests for critical flows (login, review submission, admin actions).
- **Contract testing**: Lock down API responses (via snapshots or schema validation) to detect regressions early.

## Monitoring & Observability

- **CloudWatch dashboards**: Visualize CPU, memory, response time, and queue length for EC2/containers.
- **Alerts**: Notify when key metrics (e.g., failed migrations, queue backlog) cross thresholds.
- **Log aggregation**: Centralize logs from Fastify, scrapers, and scripts for better analysis.

## Security & Compliance

- **Cloudflare IP automation**: Automate updates to the hardcoded Cloudflare IP list or consider using a more flexible firewall solution.
- **WAF**: Consider adding AWS WAF or Cloudflare WAF rules to protect from known OWASP threats.
- **Secrets rotation**: Rotate JWT, DB, and Redis secrets periodically via Terraform or Automation scripts.

## Cost Optimization

- **Free Tier monitoring**: Build alerts when EC2/RDS run in a non-Free Tier state (e.g., upgraded size, extra volumes).
- **Reserved Instances**: If usage stabilizes, evaluate reserved instances for RDS or EC2 to reduce cost.

## Feature Roadmap

- **Email verification & password resets**: Complete the auth flows with email delivery + tokens stored securely.
- **Moderation UX**: Improve admin dashboards with filtering, bulk actions, and clearer status indicators.
- **Additional universities**: Expand scraper coverage beyond UTS (Monash, La Trobe, etc.) using modular strategy pattern.
- **User analytics**: Track user engagement, review submissions, and prevailing sentiments to inform roadmap decisions.

---

Update this file whenever you introduce a new improvement idea, prototype, or architectural experiment that deserves attention.
