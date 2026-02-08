# Angulectron Workspace

Angular + Electron desktop foundation built as an Nx monorepo.

## What This Repository Is

This repo provides a secure, typed desktop application baseline with:

- Angular 21 renderer (`apps/renderer`)
- Electron main process (`apps/desktop-main`)
- Electron preload bridge (`apps/desktop-preload`)
- Shared IPC contracts (`libs/shared/contracts`)
- Typed renderer desktop API (`libs/platform/desktop-api`)
- UI libraries for Material, primitives, and Carbon adapters (`libs/ui/*`)

Core design goal: keep the renderer unprivileged and route all privileged operations through preload + main with validated contracts.

## Runtime Model

1. Renderer calls `window.desktop.*` via `libs/platform/desktop-api`.
2. Preload validates and forwards requests over IPC.
3. Main process validates again and executes privileged operations.
4. Response returns as typed `DesktopResult<T>` envelopes.

Security defaults in desktop runtime include:

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`

## Prerequisites

- Node.js `^24.13.0`
- pnpm `^10.14.0`

## Setup

```bash
pnpm install
```

## Common Commands

Quality gates:

```bash
pnpm lint
pnpm unit-test
pnpm build
```

Renderer-only dev:

```bash
pnpm renderer:serve
```

Desktop dev (Windows one-command flow):

```bash
pnpm desktop:dev:win
```

If local Nx state gets stuck/locked on Windows:

```bash
pnpm workspace:refresh:win
```

Then relaunch desktop dev:

```bash
pnpm desktop:dev:win
```

## Repository Layout

Top-level:

- `apps/` runnable applications
- `libs/` reusable libraries
- `tools/` scripts and utilities
- `docs/` architecture, engineering standards, delivery, governance

Key projects:

- `apps/renderer` Angular shell + routed feature pages
- `apps/desktop-main` Electron privileged runtime
- `apps/desktop-preload` secure renderer bridge
- `apps/renderer-e2e` Playwright E2E tests

## Documentation Map

Start here:

- Docs index: `docs/docs-index.md`
- Onboarding guide: `docs/03-engineering/onboarding-guide.md`

Architecture and standards:

- Solution architecture: `docs/02-architecture/solution-architecture.md`
- Repo topology and boundaries: `docs/02-architecture/repo-topology-and-boundaries.md`
- Security architecture: `docs/02-architecture/security-architecture.md`
- IPC contract standard: `docs/02-architecture/ipc-contract-standard.md`
- UI system governance: `docs/02-architecture/ui-system-governance.md`

Engineering rules:

- Coding standards: `docs/03-engineering/coding-standards.md`
- Testing strategy: `docs/03-engineering/testing-strategy.md`
- Reliability and error handling: `docs/03-engineering/reliability-and-error-handling.md`
- Observability and diagnostics: `docs/03-engineering/observability-and-diagnostics.md`
- Security review workflow: `docs/03-engineering/security-review-workflow.md`

Process and delivery:

- Git and PR policy: `docs/03-engineering/git-and-pr-policy.md`
- CI/CD spec: `docs/04-delivery/ci-cd-spec.md`
- Release management: `docs/04-delivery/release-management.md`
- Definition of Done: `docs/05-governance/definition-of-done.md`

## Contribution Rules (Critical)

- Do not push directly to `main`.
- Use short-lived branches (`feat/*`, `fix/*`, `chore/*`).
- Merge via PR only after required checks and approvals.
- Use Conventional Commits.

Source of truth: `docs/03-engineering/git-and-pr-policy.md`.
