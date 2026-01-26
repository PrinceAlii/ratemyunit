# Specification - Fix Auto-Discovery Scanner

## Problem Statement
The "Auto-Discovery" feature in the Admin Dashboard is intended to crawl university handbooks (primarily UTS) and automatically discover new units to add to the queue for scraping. Currently, while the UI might trigger the action, no units are being successfully queued in BullMQ/Redis, and the discovery process fails to populate the database.

## Objectives
- Identify the root cause of why units are not being queued during the "Scan" operation.
- Verify the communication between the Admin route and the Scraper service/BullMQ.
- Ensure the UTS discovery strategy correctly identifies unit codes from the handbook.
- Fix the logic to successfully push discovered units into the `scraper` queue.

## Success Criteria
- Admin initiates a "Range Scan" or "Auto-Discovery".
- Logs/Monitoring confirm that unit codes are being identified.
- Discovered units appear as jobs in the BullMQ queue.
- Scraper workers begin processing the newly queued units.
