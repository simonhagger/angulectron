# Dependency And Upgrade Policy

Owner: Dev Experience + Security  
Review cadence: Quarterly  
Last reviewed: 2026-02-13

## Automation

- Renovate runs weekly.
- Dev dependency patch updates may auto-merge after green CI.

## Review Rules

- Minor/major upgrades require human review.
- Security patches are prioritized and handled within SLA.

## Versioning

- Prefer explicit semver ranges aligned to supported framework versions.
- Remove abandoned/unmaintained packages proactively.

## SLA

- Critical security advisories: patch within 48 hours.
- High-severity advisories: patch within 5 business days.

## Verification

- Every upgrade PR must run full quality gates.
