# CI/CD Spec

Owner: Dev Experience  
Review cadence: Quarterly  
Last reviewed: 2026-02-13

## Platform

- GitHub Actions.

## Required Jobs

- `security-checklist-gate` (PR only)
- `format:check`
- `lint`
- `typecheck`
- `unit-test`
- `integration-test`
- `e2e-smoke`
- `a11y-e2e`
- `i18n-check`
- `build-renderer`
- `build-desktop`
- `dependency-audit`
- `license-compliance`
- `perf-check`
- `artifact-publish` (push to `main` only)

Notes:

- `unit-test` must execute `desktop-main:test`, which includes:
  - `desktop-main:test-ts` (Vitest)
  - `desktop-main:test-python` (pytest + coverage gate)

## Caching

- pnpm cache via `actions/setup-node`.
- Nx computation caching enabled per target.

## Artifacts

- Performance report artifact uploaded by `perf-check`.
- Desktop build artifacts uploaded on `main` push by `artifact-publish`.
- Python sidecar coverage XML emitted at `coverage/apps/desktop-main/python-sidecar-coverage.xml` during `desktop-main:test-python`.
