# Decision Log

Owner: Platform Engineering  
Review cadence: Weekly  
Last reviewed: 2026-02-13

## Purpose

Record accepted architecture/process decisions and maintain links to canonical policy documents.

| ADR      | Date       | Status   | Summary                                                                         | Canonical Reference                              |
| -------- | ---------- | -------- | ------------------------------------------------------------------------------- | ------------------------------------------------ |
| ADR-0001 | 2026-02-06 | Accepted | Nx monorepo with Angular 21 + Electron baseline                                 | `docs/02-architecture/solution-architecture.md`  |
| ADR-0002 | 2026-02-06 | Accepted | Material-first UI with controlled Carbon adapters                               | `docs/02-architecture/ui-system-governance.md`   |
| ADR-0003 | 2026-02-06 | Accepted | Transloco runtime i18n strategy                                                 | `docs/02-architecture/a11y-and-i18n-standard.md` |
| ADR-0004 | 2026-02-06 | Accepted | Trunk-based workflow with PR-only protected main                                | `docs/03-engineering/git-and-pr-policy.md`       |
| ADR-0005 | 2026-02-07 | Accepted | Privileged-boundary contract policy (`DesktopResult`, Zod, versioned envelopes) | `docs/02-architecture/ipc-contract-standard.md`  |
| ADR-0006 | 2026-02-07 | Accepted | Electron hardening baseline with preload-only capability bridge                 | `docs/02-architecture/security-architecture.md`  |
| ADR-0007 | 2026-02-12 | Accepted | Desktop OIDC architecture: main-process PKCE and secure token handling          | `docs/05-governance/oidc-auth-backlog.md`        |
| ADR-0008 | 2026-02-13 | Accepted | CI release gating includes security checklist and performance regression checks | `docs/04-delivery/ci-cd-spec.md`                 |

## Retrospective Note

This log has been backfilled from established project standards and implemented workspace behavior. Future architecture decisions should be added at decision time and cross-linked from PRs.
