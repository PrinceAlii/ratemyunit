# Specification - Optimize Scraper Service for High Throughput

## Overview
The scraper service needs to be optimized to handle thousands of units efficiently. The goal is to maximize throughput and clear the backlog of discovered units as quickly as possible. This involves implementing adaptive concurrency and an aggressive strategy with backoff mechanisms.

## Functional Requirements
- **Adaptive Concurrency:** The system should dynamically adjust the number of parallel scraping workers. It should scale up when resources allow and success rates are high, and scale down if errors or blocks increase.
- **Aggressive Scraping Strategy:** The default behavior should be to process jobs as quickly as possible.
- **Exponential Backoff:** If the target site detects scraping or returns errors (429/403), the worker must pause and retry with an exponential backoff strategy to avoid permanent blocking.
- **Performance Monitoring:** Real-time tracking of "Units per Minute" and "Success/Failure Rates" must be visible (logs or dashboard).

## Non-Functional Requirements
- **Scalability:** The architecture must support running multiple worker instances (horizontal scaling).
- **Resilience:** The system must not crash under high load; individual job failures should be isolated and retried.
- **Resource Management:** Ensure memory and CPU usage remain within safe limits during high concurrency.

## Success Criteria
- Throughput increases significantly (target: > X units/minute).
- System automatically throttles down when error rates spike.
- 1000s of units can be processed without manual intervention.
