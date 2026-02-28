# Scraper Hardening And Throughput Plan

## Objectives
- Eliminate browser crash-related scrape failures such as `browser.newPage: Target page, context or browser has been closed`.
- Normalize handbook payload shape drift (for example `faculty` as object) before validation.
- Improve enqueue/discovery efficiency by removing expensive per-code queue lookups.

## Problem Areas
- Chromium instability in pooled workers can leave a borrowed browser unusable mid-job.
- Some CourseLoop payloads return nested objects where schema expects scalar strings.
- Discovery and bulk queueing paths perform O(n) `getJob` checks before `addBulk`.
- Discovery strategies include fixed sleeps that add deterministic latency.

## Implementation

### 1) Browser Crash Resilience
- Simplify worker Chromium args in `apps/api/src/lib/queue.ts` by removing `--single-process` and `--no-zygote`.
- Detect browser crash-like errors using shared pattern matching.
- In worker scrape flow:
  - If scrape returns crash-like error, destroy borrowed browser, re-acquire from pool, and retry once in-process.
  - If retryable error persists, throw to let BullMQ attempts/backoff handle retries.
  - Log `durationMs`, `browserRecycled`, `unitCode`, and `universityId`.

### 2) Data Shape Normalization
- Add shared coercion helper in `apps/api/src/scrapers/strategies/utils.ts`.
- Normalize `parent_academic_org` in `apps/api/src/scrapers/strategies/courseloop.ts` before validation.
- Keep validator strict (`faculty` remains optional string) so stored data quality stays consistent.

### 3) Queue Efficiency
- Remove per-code `scraperQueue.getJob(...)` loops before `addBulk` in:
  - `apps/api/src/lib/queue.ts` discovery flow
  - `apps/api/src/routes/admin.ts` bulk scrape route
- Rely on deterministic `jobId` deduplication in BullMQ.

### 4) Discovery Latency
- Replace fixed waits with condition-based readiness in:
  - `apps/api/src/scrapers/strategies/courseloop.ts`
  - `apps/api/src/scrapers/strategies/generic.ts`
- Use sitemap response text directly in CourseLoop sitemap discovery instead of page DOM extraction.

## Tests
- Add helper tests for:
  - browser crash error classification
  - string coercion from object payloads
- Add CourseLoop extraction tests for:
  - object `parent_academic_org` normalization
  - unknown object shape fallback to `undefined`
- Update affected admin route tests for bulk queueing behavior.

## Validation Checklist
- `npm run lint`
- `npm run typecheck`
- `npm test`

## Success Criteria
- Crash-like browser failures recover within the same job attempt when possible.
- UNSW-style `faculty` object payloads no longer fail validation.
- Bulk/discovery enqueue time improves for large code sets due to removed N+1 queue lookups.
