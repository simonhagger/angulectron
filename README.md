# Electron Angular Foundation

Enterprise baseline workspace for Angular 21 + Electron desktop applications.

## Stack

- Nx monorepo + pnpm
- Angular 21 renderer
- Electron main + preload separation
- Material-first UI governance + Tailwind utilities + Carbon adapters
- Zod-validated IPC contracts
- Transloco runtime i18n (`en-US` baseline)
- Vitest + Playwright + axe gates

## Quick Start

```bash
pnpm install
pnpm build
pnpm lint
pnpm unit-test
pnpm e2e-smoke
```

## Repository Topology

- `apps/renderer`
- `apps/desktop-main`
- `apps/desktop-preload`
- `libs/shared/contracts`
- `libs/platform/desktop-api`
- `libs/ui/*`
- `libs/domain/*`
- `libs/data-access/*`
- `libs/feature/*`
- `libs/util/*`

## Engineering Docs

- Onboarding guide: `docs/03-engineering/onboarding-guide.md`
- Charter: `docs/01-charter/product-engineering-charter.md`
- Architecture: `docs/02-architecture/*`
- Engineering rules: `docs/03-engineering/*`
- Delivery model: `docs/04-delivery/*`
- Governance: `docs/05-governance/*`

## Branching And Releases

- Protected `main`, PR-only merge policy.
- Conventional Commits + Changesets.
- Channels: `dev`, `beta`, `stable`.

## Notes

- Set `TMPDIR=/tmp` for local Nx commands when running on mounted Windows drives in WSL.
- Replace placeholder CODEOWNERS handles in `.github/CODEOWNERS`.
