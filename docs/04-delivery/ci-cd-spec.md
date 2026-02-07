# CI/CD Spec

## Platform

- GitHub Actions.

## Required Jobs

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
- `artifact-publish`

## Caching

- pnpm cache via `actions/setup-node`.
- Nx computation caching enabled per target.

## Artifacts

- Desktop build artifacts uploaded on `main` push.
