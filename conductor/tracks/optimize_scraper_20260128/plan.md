# Implementation Plan - Optimize Scraper Service

## Phase 1: Analysis & Benchmarking
- [~] Task: Establish Performance Baseline
    - [ ] Create a benchmark script or test case to queue a batch of units (e.g., 50-100).
    - [ ] Measure current throughput (units/minute) and resource usage.
    - [ ] Identify primary bottlenecks (Network latency, CPU parsing, DB writes).
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Analysis & Benchmarking' (Protocol in workflow.md)

## Phase 2: Core Optimization Implementation
- [x] Task: Implement Aggressive Backoff Strategy
    - [x] Configure BullMQ job options to use exponential backoff for retries.
    - [x] Update Scraper Service to strictly identify 429/403 (blocking) errors versus other failures.
- [x] Task: Optimize Concurrency
    - [x] Update the Worker initialization in `apps/api/src/lib/queue.ts` to allow higher concurrency (configurable via env vars).
    - [x] Implement a mechanism to scale down concurrency if blocking errors spike (Adaptive Logic).
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Optimization Implementation' (Protocol in workflow.md)

## Phase 3: Monitoring & Validation
- [ ] Task: Add Performance Telemetry
    - [ ] Implement logging/monitoring for "Throughput (Units/Min)" and "Success vs Failure Rates".
- [ ] Task: Large Scale Stress Test
    - [ ] Queue a large batch (1000+ units).
    - [ ] Monitor execution to ensure the system stabilizes and handles rate limits without crashing.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Monitoring & Validation' (Protocol in workflow.md)
