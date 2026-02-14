# Onboarding Guide (Human + AI)

Owner: Dev Experience  
Review cadence: Quarterly  
Last reviewed: 2026-02-13

## Purpose

This guide is the fastest way to understand and work safely in this repository.
It is written for:

- Human engineers joining the project
- AI coding agents operating in the workspace

It focuses on repository structure, runtime architecture, workflows, and guardrails.

## Quick Start

Prerequisites:

- Node.js `^24.13.0`
- pnpm `^10.14.0`
- Python `3.11+` (required for Python sidecar lab and Python-side test gate)

Install and baseline checks:

```bash
pnpm install
pnpm lint
pnpm unit-test
pnpm build
```

Fast UI review:

```bash
pnpm renderer:serve
```

Desktop app review on Windows:

```bash
pnpm desktop:dev:win
```

Local performance checks:

```bash
pnpm perf:start
pnpm perf:ipc
pnpm perf:memory
```

## Repository At A Glance

Top-level:

- `apps/` runnable applications
- `libs/` reusable libraries
- `docs/` engineering, architecture, governance
- `tools/` scripts and utilities

Applications:

- `apps/renderer` Angular UI shell
- `apps/desktop-main` Electron main process
- `apps/desktop-preload` Electron preload bridge
- `apps/renderer-e2e` Playwright tests

Libraries:

- `libs/shared/contracts` IPC channels, schemas, `DesktopResult<T>`
- `libs/platform/desktop-api` typed renderer API surface (`window.desktop`)
- `libs/domain/core` domain-level logic
- `libs/data-access/repository` data access layer
- `libs/feature/shell` UI feature orchestration
- `libs/ui/material` Material UI primitives
- `libs/ui/primitives` shared visual primitives
- `libs/ui/carbon-adapters` Carbon-compatible adapters
- `libs/util/common` cross-cutting utility helpers

## Runtime Architecture

Primary flow:

1. Renderer calls `window.desktop.*`
2. Preload validates and forwards via `ipcRenderer.invoke`
3. Main validates against shared Zod contracts
4. Main returns `DesktopResult<T>`
5. Renderer updates signal-driven UI state

Security posture:

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- Renderer treated as untrusted
- Privileged operations terminate in preload/main

## Boundaries And Dependency Rules

Source of truth: `docs/02-architecture/repo-topology-and-boundaries.md`

Key rules:

- Apps depend on libs, not other apps
- UI/renderer code must not directly use Node or OS APIs
- Electron/OS specifics stay in `apps/desktop-*` and `libs/platform/*`
- Domain libs must not depend on data-access libs

Nx tags encode these constraints (`type:*`, `platform:*`, `scope:*`).

## Standard Workflows

Format:

```bash
pnpm format
pnpm format:check
```

Lint:

```bash
pnpm lint
```

Tests:

```bash
pnpm unit-test
pnpm nx run desktop-main:test-python
pnpm integration-test
pnpm e2e-smoke
pnpm a11y-e2e
```

Build:

```bash
pnpm build-renderer
pnpm build-desktop
pnpm build
```

Release:

```bash
pnpm changeset
pnpm version-packages
pnpm release
```

## Review And Delivery Gates

A change is not done unless all apply:

- Correct app/lib boundary placement
- Tests updated for changed behavior
- CI checks pass
- i18n and accessibility impact considered
- Docs updated if policy/behavior changed
- ADR added for architecture-level changes

Reference: `docs/05-governance/definition-of-done.md`

## Local Development Notes

- Preferred package manager: pnpm
- Preferred task execution: Nx (`pnpm nx ...`)
- On Windows, use `pnpm desktop:dev:win` for one-command desktop launch
- If Electron ever behaves like Node, clear `ELECTRON_RUN_AS_NODE`
- OIDC/API runtime setup is managed in-app via `Settings` (`Auth`, `API`) and can be imported from `examples/config/*.json`
- Packaged runtime configuration file path: `%APPDATA%\Angulectron\config\runtime-config.json`

## Troubleshooting

Port 4200 already in use:

- Stop previous dev servers, or reuse existing renderer server
- `desktop:dev:win` already handles this common case

Nx/cache weirdness:

```bash
pnpm nx reset
```

Dependency drift:

```bash
pnpm install
```

## Orientation For AI Agents

Before making edits:

1. Read `AGENTS.md`
2. Read this guide
3. Read relevant architecture/engineering docs for touched area

Working expectations:

- Use Nx commands for lint/test/build/task execution
- Respect layer boundaries and tags
- Make minimal, targeted changes
- Validate with relevant lint/test/build commands before finishing
- Do not use destructive git operations
- Do not revert unrelated user changes
- Keep security model intact (renderer untrusted, privileged access via contracts)
- For security-sensitive changes, complete PR security checklist items

When adding new capability:

- Define/update IPC contracts in `libs/shared/contracts`
- Update preload/main handlers and tests
- Keep error envelope and validation behavior consistent
- Update docs if behavior/policy changes

## Suggested Reading Order

1. `README.md`
2. `docs/01-charter/product-engineering-charter.md`
3. `docs/02-architecture/solution-architecture.md`
4. `docs/02-architecture/repo-topology-and-boundaries.md`
5. `docs/02-architecture/security-architecture.md`
6. `docs/03-engineering/coding-standards.md`
7. `docs/03-engineering/testing-strategy.md`
8. `docs/04-delivery/ci-cd-spec.md`
9. `docs/05-governance/definition-of-done.md`
