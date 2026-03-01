# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in RateMyUnit, please report it privately.

- Email: `security@ratemyunit.dev`
- Subject: `Security Vulnerability Report`

Please include:

- A clear description of the issue.
- Steps to reproduce.
- Impact assessment (what could be accessed or modified).
- Any proof-of-concept details.
- Suggested remediation (if available).

Do not disclose vulnerabilities publicly until we have investigated and released a fix.

## Response Targets

- Initial acknowledgement: within 72 hours.
- Triage decision: within 7 days.
- Status updates: at least every 7 days while remediation is in progress.

## Scope

In scope:

- `apps/api` backend APIs and authentication/authorization logic.
- `apps/web` frontend behavior that can affect security.
- `packages/db`, migrations, and infrastructure under `terraform/`.

Out of scope:

- Vulnerabilities requiring physical device access.
- Denial-of-service traffic volume testing against production.
- Social engineering or credential phishing.

## Safe Harbor

We support good-faith security research that follows this policy and avoids privacy violations, service disruption, and data destruction.
