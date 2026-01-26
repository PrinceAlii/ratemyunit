# Implementation Plan - Fix Auto-Discovery Scanner

## Phase 1: Diagnosis & Investigation
- [ ] Task: Investigate Admin Scanner Route
    - [ ] Locate and read the API route handling the "Scan" request (likely in `apps/api/src/routes/admin.ts`).
    - [ ] Trace the execution flow from the route to the scraper service.
- [ ] Task: Audit Scraper Service & BullMQ Integration
    - [ ] Examine `apps/api/src/services/scraper.ts` and `apps/api/src/lib/queue.ts`.
    - [ ] Add temporary logging to verify if the queue `add` method is being called.
- [ ] Task: Verify UTS Discovery Strategy
    - [ ] Review `apps/api/src/scrapers/uts/` and the discovery logic.
    - [ ] Check if the handbook structure has changed or if selectors are failing.

## Phase 2: Implementation & Fixes
- [ ] Task: Fix Queuing Logic
    - [ ] Correct any mismatches between the discovery output and the queue input requirements.
    - [ ] Ensure proper error handling during the queuing process.
- [ ] Task: Update Selectors/Strategy (if applicable)
    - [ ] Update Playwright selectors if the discovery failure is due to handbook changes.

## Phase 3: Verification
- [ ] Task: Manual Verification in Development
    - [ ] Run `docker-compose up` to ensure Redis/Postgres are active.
    - [ ] Trigger a scan from the Admin UI or via a direct API call (using `curl` or similar).
    - [ ] Verify jobs appear in Redis (e.g., via logs or a tool like BullBoard if available).
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Verification' (Protocol in workflow.md)
