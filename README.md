# Angulectron Workspace

Angular 21 + Electron desktop foundation built as an Nx monorepo.

## Who This Is For

- Human engineers onboarding to the desktop platform.
- AI coding agents operating inside this workspace.

## Repository Purpose

This repository is a secure, typed baseline for desktop applications with strict privilege boundaries:

- Renderer UI: `apps/renderer`
- Electron main process: `apps/desktop-main`
- Electron preload bridge: `apps/desktop-preload`
- E2E tests: `apps/renderer-e2e`
- Shared IPC contracts: `libs/shared/contracts`
- Typed desktop API surface for renderer: `libs/platform/desktop-api`

Core design principle:

- Renderer is untrusted.
- Privileged capabilities terminate in preload/main.
- Contracts are validated and versioned.

## Runtime Model

1. Renderer calls `window.desktop.*` via `@electron-foundation/desktop-api`.
2. Preload validates request/response envelopes and invokes IPC.
3. Main validates payloads again and performs privileged work.
4. Responses return as `DesktopResult<T>`.

Security defaults:

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`

## Feature Surface (Current)

Renderer routes include:

- Home and diagnostics/lab flows (`/`, `/ipc-diagnostics`, `/telemetry-console`, `/auth-session-lab`)
- UI system showcases (`/material-showcase`, `/carbon-showcase`, `/tailwind-showcase`, `/material-carbon-lab`)
- Data/form/workbench flows (`/data-table-workbench`, `/form-validation-lab`, `/async-validation-lab`)
- File/storage/API/update tooling (`/file-tools`, `/file-workflow-studio`, `/storage-explorer`, `/api-playground`, `/updates-release`)

Desktop API surface includes:

- `desktop.app.*` (version/runtime diagnostics)
- `desktop.auth.*` (sign-in/out, session summary, token diagnostics)
- `desktop.dialog.openFile()` + `desktop.fs.readTextFile()`
- `desktop.storage.*`
- `desktop.api.invoke()`
- `desktop.updates.check()`
- `desktop.telemetry.track()`
- `desktop.python.*` (local Python sidecar probe/inspect/stop for privileged helper workflows)

## Expected Behaviors

- Renderer must never access Node/Electron APIs directly.
- All privileged IPC calls must be validated in preload and main.
- Error responses should use typed envelopes with correlation IDs.
- Auth tokens stay out of renderer; bearer handling occurs in main process.
- Frontend should use Angular v21 patterns by default unless explicitly agreed otherwise.

## Prerequisites

- Node.js `^24.13.0`
- pnpm `^10.14.0`
- Python `3.11+` (required for Python sidecar lab/tests)

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
```

Notes:

- Playwright browser binaries are local environment artifacts, not tracked in git.
- E2E is configured to run against a clean test server on `http://localhost:4300`.
- On Windows, if you see `Keytar unavailable` warnings, run `pnpm native:rebuild:keytar`.

## Day-One Commands

Desktop development (Windows):

```bash
pnpm desktop:dev:win
```

Renderer-only development:

```bash
pnpm renderer:serve
```

## Quality Commands

```bash
pnpm lint
pnpm unit-test
pnpm nx run desktop-main:test-python
pnpm integration-test
pnpm e2e-smoke
pnpm a11y-e2e
pnpm i18n-check
pnpm build
pnpm ci:local
```

## Packaging Commands

```bash
pnpm forge:make
pnpm forge:make:staging
pnpm forge:make:production
```

Flavor behavior:

- `forge:make:staging`
  - sets `APP_ENV=staging`
  - enables packaged DevTools (`DESKTOP_ENABLE_DEVTOOLS=1`)
  - builds renderer in `staging` mode so Labs routes remain available for verification
- `forge:make:production`
  - sets `APP_ENV=production`
  - disables packaged DevTools (`DESKTOP_ENABLE_DEVTOOLS=0`)

## OIDC Configuration (Desktop)

Required environment variables:

- `OIDC_ISSUER`
- `OIDC_CLIENT_ID`
- `OIDC_REDIRECT_URI` (loopback, example: `http://127.0.0.1:42813/callback`)
- `OIDC_SCOPES` (must include `openid`)

Optional:

- `OIDC_AUDIENCE`
- `OIDC_ALLOW_INSECURE_TOKEN_STORAGE=1` (development fallback only)

Local setup:

1. Copy `.env.example` to `.env.local`.
2. Add OIDC values.
3. Run `pnpm desktop:dev:win`.

Token persistence behavior:

- Windows preference order: `keytar` -> encrypted file store (Electron `safeStorage`) -> plaintext file store only when `OIDC_ALLOW_INSECURE_TOKEN_STORAGE=1`.
- If `keytar` native binding is missing, run:
  - `pnpm native:rebuild:keytar`

## Bring Your Own Secure API Endpoint

The `call.secure-endpoint` API operation is endpoint-configurable and does not rely on a hardcoded private URL.

Set in `.env.local`:

- `API_SECURE_ENDPOINT_URL_TEMPLATE`
- `API_SECURE_ENDPOINT_CLAIM_MAP` (optional JSON map of placeholder -> JWT claim path)

Requirements:

- Must be `https://`.
- Placeholder values can come from request params and/or mapped JWT claims.
- Endpoint should accept bearer JWT from the desktop OIDC flow.

Examples:

- `API_SECURE_ENDPOINT_URL_TEMPLATE=https://your-api.example.com/users/{{user_id}}/portfolio`
- `API_SECURE_ENDPOINT_CLAIM_MAP={"user_id":"sub","tenant_id":"org.id"}`

If not configured, calling `call.secure-endpoint` returns a typed `API/OPERATION_NOT_CONFIGURED` failure.

## Python Sidecar Backend Pattern

This workspace supports a local Python helper backend model for privileged desktop capabilities (for example, file parsing libraries such as PyMuPDF).

Current status:

- Implemented as a lab capability (`Python Sidecar Lab` route).
- Runs a local sidecar HTTP service bound to loopback (`127.0.0.1`).
- Main process remains the security policy enforcement point.

Pattern:

1. Renderer selects a file via typed desktop dialog API.
2. Renderer receives a short-lived file token, not a raw path.
3. Preload/main validates contract envelopes.
4. Main resolves token (window-scoped + expiring), validates file extension and magic header, then calls Python sidecar.
5. Main returns safe diagnostics/results to renderer.

Security properties:

- Renderer cannot pass arbitrary filesystem paths for privileged parsing.
- File ingress is fail-closed on extension/signature mismatch.
- Helper runtime is local-only and not a renderer-controlled authority.

How to run/verify:

- Open `Python Sidecar Lab`.
- `Probe Sidecar` to start/diagnose local runtime.
- `Select PDF` then `Inspect Selected PDF` to verify end-to-end file handoff.
- Run test gate:
  - `pnpm nx run desktop-main:test-python`

Deterministic packaged runtime (staging/production):

- Provide a local bundled runtime payload at:
  - `build/python-runtime/<platform>-<arch>/`
  - example: `build/python-runtime/win32-x64/`
- Pin sidecar dependencies in:
  - `apps/desktop-main/python-sidecar/requirements-runtime.txt`
- Fast local bootstrap from your current Python install:
  - `pnpm run python-runtime:prepare-local`
- Add `manifest.json` with `executableRelativePath` (see `build/python-runtime/README.md`).
- Run validation:
  - `pnpm run python-runtime:assert`
  - assertion verifies interpreter exists and imports `fitz` when PyMuPDF is declared in manifest
- Runtime payload is copied into desktop build artifacts by:
  - `pnpm run build-desktop-main`
  - `pnpm run forge:make:staging`
  - `pnpm run forge:make:production`
- Staging/production package commands fail fast if runtime bundle is missing or invalid.
- Runtime diagnostics include `pythonExecutable` so packaged builds can prove the sidecar path at runtime.

How to extend for new Python-backed operations:

- Add a new typed channel/contract in `libs/shared/contracts`.
- Add preload API binding in `apps/desktop-preload`.
- Add main handler validation and token/scope checks in `apps/desktop-main`.
- Add sidecar endpoint behavior in `apps/desktop-main/src/assets/python_sidecar/service.py`.
- Add/extend Python tests under `apps/desktop-main/python-sidecar/tests`.

## Repository Layout

- `apps/` runnable applications
- `libs/` reusable libraries
- `tools/` scripts/utilities
- `docs/` architecture, standards, delivery, governance

## Human + Agent Working Rules

- Use Nx-driven commands (`pnpm nx ...` or repo scripts wrapping Nx).
- Respect app/lib boundaries and platform tags.
- Use short-lived branches and PR workflow; do not push directly to `main`.
- Keep changes minimal and behavior-preserving unless explicitly changing behavior.
- For security-sensitive changes, include review artifacts and negative-path tests.

## Documentation Map

Start here:

- `docs/docs-index.md`
- `docs/03-engineering/onboarding-guide.md`

Architecture:

- `docs/02-architecture/solution-architecture.md`
- `docs/02-architecture/repo-topology-and-boundaries.md`
- `docs/02-architecture/security-architecture.md`
- `docs/02-architecture/ipc-contract-standard.md`

Engineering:

- `docs/03-engineering/coding-standards.md`
- `docs/03-engineering/testing-strategy.md`
- `docs/03-engineering/reliability-and-error-handling.md`
- `docs/03-engineering/observability-and-diagnostics.md`
- `docs/03-engineering/security-review-workflow.md`

Delivery + governance:

- `docs/04-delivery/ci-cd-spec.md`
- `docs/04-delivery/release-management.md`
- `docs/05-governance/definition-of-done.md`
- `docs/05-governance/backlog.md`
- `CURRENT-SPRINT.md`

## Contribution Policy (Critical)

- No direct commits to `main`.
- Branch naming: `feat/*`, `fix/*`, `chore/*`.
- Merge by PR after required checks and approvals.
- Conventional Commits required.

Canonical policy:

- `docs/03-engineering/git-and-pr-policy.md`
- `tools/templates/pr-body-template.md` (local PR authoring template)
