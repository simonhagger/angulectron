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

Windows packaging (deterministic clean + make):

```bash
pnpm forge:make
```

Packaging notes:

- `forge:make` now runs `forge:clean` first to remove stale outputs from `out/`.
- Windows distributable is ZIP-based (no interactive installer prompts).
- Output ZIP location:
  - `out/make/zip/win32/x64/`
  - filename pattern: `@electron-foundation-source-win32-x64-<version>.zip`
- Extract the ZIP, then run:
  - `Angulectron.exe`

If local Nx state gets stuck/locked on Windows:

```bash
pnpm workspace:refresh:win
```

Then relaunch desktop dev:

```bash
pnpm desktop:dev:win
```

## OIDC Authentication (Desktop)

OIDC support is implemented in main/preload with Authorization Code + PKCE.

Required environment variables:

- `OIDC_ISSUER`
- `OIDC_CLIENT_ID`
- `OIDC_REDIRECT_URI` (loopback URI, for example `http://127.0.0.1:42813/callback`)
- `OIDC_SCOPES` (must include `openid`)

Optional:

- `OIDC_AUDIENCE`
- `OIDC_ALLOW_INSECURE_TOKEN_STORAGE=1` (development-only fallback when OS secure storage is unavailable)

Recommended local setup:

1. Copy `.env.example` to `.env.local`.
2. Fill in your OIDC values.
3. Run `pnpm desktop:dev:win`.

`desktop:dev:win` now auto-loads `.env` and `.env.local` (with `.env.local` taking precedence).

Runtime behavior:

- Refresh tokens are stored in OS secure storage on Windows (`keytar`) with encrypted file fallback.
- Renderer can only call `desktop.auth.signIn()`, `desktop.auth.signOut()`, and `desktop.auth.getSessionSummary()`.
- Access token attachment for secured API operations occurs in main process only.

Temporary compatibility note:

- Current Clerk OAuth flow may issue JWT access tokens without API `aud` claim in this tenant.
- AWS JWT authorizer is temporarily configured to accept both:
  - API audience (`YOUR_API_AUDIENCE`)
  - OAuth client id (`YOUR_OAUTH_CLIENT_ID`)
- This is tracked for removal in `docs/05-governance/backlog.md` (`BL-014`) and `docs/05-governance/oidc-auth-backlog.md`.

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
