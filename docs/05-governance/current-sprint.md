# Current Sprint

Owner: Platform Engineering + Security  
Review cadence: Weekly  
Last reviewed: 2026-02-15  
Sprint window: 2026-02-15 onward (Sprint 5)  
Status: Active

## Sprint Goal

Complete deterministic runtime packaging, close governance ownership gaps, and lay a secure foundation for extensible external execution providers.

## In Scope (Committed, Highest Value First)

- `BL-029` Standardize official Python runtime distribution for sidecar bundling (close remaining CI reproducibility proof).
- `BL-039` Replace placeholder CODEOWNERS entries with real maintainers.
- `BL-046` Introduce provider-agnostic external execution gateway abstraction (contract + main-process baseline).
- `BL-047` Add typed operation registry for gateway invocation allowlists.

## Out of Scope (This Sprint)

- `BL-020`, `BL-034`, `BL-035` i18n expansion beyond current proof-of-pattern state.
- `BL-049` external adapter implementation (Docker-local) until gateway + registry baseline is stable.
- `BL-050` capability confirmation UX until sensitive-operation metadata model is defined in `BL-047`.

## Delivery Status (Starting Point)

- `BL-029` in progress and partially delivered; local and CI packaging hardening landed, now requires consistent proof path and documentation closure for deterministic runtime assembly.
- `BL-039` planned and unblocked.
- `BL-046` and `BL-047` proposed; architecture direction agreed, implementation not yet started.

## Execution Plan (Coherent + Testable)

1. `BL-029C` Deterministic packaging closure

- Scope: finalize and validate repeatable runtime prep/assert flow across dev/staging/prod build paths with no system-python dependency in packaged runs.
- Proof:
  - `pnpm run python-runtime:prepare-local`
  - `pnpm run python-runtime:assert`
  - `pnpm run build-desktop-main`
  - `pnpm forge:make:staging`

2. `BL-039A` CODEOWNERS hardening

- Scope: replace placeholders with real maintainers and keep required-review behavior intact.
- Proof:
  - `rg "@your-org|example" .github/CODEOWNERS`
  - `pnpm docs-lint`

3. `BL-046A` Gateway abstraction baseline

- Scope: add provider-agnostic gateway interface in desktop-main with strict IPC boundary preserved; renderer contract remains stable.
- Proof:
  - `pnpm nx run shared-contracts:test`
  - `pnpm nx run desktop-main:test`

4. `BL-047A` Typed operation registry baseline

- Scope: enforce allowlisted operation IDs with per-operation schema/limits and fail-closed handling for unknown operations.
- Proof:
  - `pnpm nx run shared-contracts:test`
  - `pnpm nx run desktop-main:test`
  - `pnpm integration-test`

## Exit Criteria

- `BL-029` moved to `Done` with reproducible packaging evidence in CI and local staging build validation.
- `BL-039` moved to `Done` with placeholder owners removed and no policy regression.
- `BL-046` and `BL-047` moved to `In Progress` (minimum) with merged baseline contracts/tests, or to `Done` if full slice completes.
- CI remains green on PR and post-merge checks.

## Progress Log

- 2026-02-15: Sprint 4 closed and merged via PR #13 with all required checks passing.
- 2026-02-15: Sprint 5 initialized with deterministic packaging closure, governance ownership hardening, and external execution gateway foundations.
- 2026-02-15: Started `BL-046`/`BL-047` baseline implementation by introducing a dedicated API operation registry module and provider-routed gateway invocation path in `desktop-main` while preserving existing renderer contract behavior.
- 2026-02-15: Started `BL-039` by replacing placeholder CODEOWNERS entries with concrete maintainer ownership (`@simonhagger`); local proof checks completed (`desktop-main:test`, `contracts:test`, `integration-test`, `docs-lint`).
- 2026-02-16: Advanced `BL-047` with operation-level request policy enforcement in the API gateway (`maxParamEntries`, `maxHeaderEntries`, value length limits) and fail-closed error behavior (`API/INVALID_PARAMS`, `API/INVALID_HEADERS`) backed by new unit tests.
