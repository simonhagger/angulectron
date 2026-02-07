# Security Review Workflow

Owner: Security + Platform Engineering  
Review cadence: Quarterly  
Last reviewed: 2026-02-07

## Trigger Conditions (Mandatory)

Security review is required for any change that introduces or modifies:

- privileged IPC channels
- native modules
- new filesystem access paths
- external API allowlist destinations
- Electron `webPreferences`, sandbox settings, or CSP controls

## Minimum Review Artifacts

- Updated IPC/API/storage contract.
- Mini threat model:
  - assets
  - trust boundaries
  - misuse/abuse cases
- Verification checklist and test evidence.

## Review Checklist Gate

- PR template must include a security section for triggered changes.
- Reviewer must explicitly confirm:
  - least-privilege boundary is maintained
  - error handling avoids sensitive leakage
  - logs/telemetry redact sensitive data
  - tests cover misuse/negative paths

## Threat Model Template (Mini)

- Asset: what is protected.
- Actor: who might attack.
- Entry point: channel/boundary.
- Abuse case: what could go wrong.
- Control: mitigation in code/config.
- Verification: tests or review evidence.
