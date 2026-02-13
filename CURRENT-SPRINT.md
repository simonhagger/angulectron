# Current Sprint

Sprint window: 2026-02-13 onward (Sprint 3)  
Owner: Platform Engineering + Security + Frontend  
Status: Active

## Sprint Goal

Finish remaining high-value hardening work without re-opening completed Sprint 1/2 scope.

## In Scope (Committed)

- `BL-028` Enforce robust file signature validation parity across all privileged ingress paths (remaining scope beyond Python sidecar baseline).
- `BL-029` Standardize official Python runtime distribution for sidecar bundling (artifact + checksum + CI reproducibility).
- `BL-020` Continue incremental renderer i18n migration for non-lab production-facing surfaces.

## Explicitly Completed (Do Not Re-Scope)

- `BL-015` Add IdP global sign-out and token revocation flow.
- `BL-021` Consolidate renderer route/nav metadata into a single typed registry.
- `BL-023` Expand IPC integration harness for preload-main real handler paths.
- `BL-025` Strengthen compile-time typing for API operation contracts end-to-end.
- `BL-026` Exclude lab routes/features from production bundle surface.
- `BL-027` Provide deterministic bundled update demo patch cycle.
- `BL-030` Deterministic packaged Python sidecar runtime baseline.
- CI hardening: targeted `format:check` base fetch now uses `FETCH_HEAD` to avoid non-fast-forward failures.

## Blocked / External Dependency

- `BL-014` remains blocked by IdP vendor token audience behavior.

## Execution Plan (Coherent + Testable)

1. `BL-028A` Privileged ingress parity

- Scope: apply centralized extension + signature validation policy to remaining privileged file ingress routes.
- Proof:
  - `pnpm nx run desktop-main:test`
  - `pnpm nx run desktop-preload:build`

2. `BL-028B` Security telemetry + docs

- Scope: add structured security events for signature mismatch / rejected file ingress and document supported types.
- Proof:
  - `pnpm nx run desktop-main:test`
  - `pnpm docs-lint`

3. `BL-029A` Official Python artifact sourcing

- Scope: replace machine-local source dependency with a pinned official distribution artifact + checksum verification.
- Proof:
  - `pnpm run python-runtime:prepare-local`
  - `pnpm run python-runtime:assert`

4. `BL-029B` CI reproducible runtime assembly

- Scope: ensure runtime bundle can be assembled deterministically in CI from pinned artifact + pinned requirements.
- Proof:
  - `pnpm run build-desktop-main`
  - `pnpm forge:make:staging`

5. `BL-020A` Incremental i18n uplift (non-lab priority)

- Scope: migrate remaining hardcoded renderer strings in non-lab routes to transloco keys/locales.
- Proof:
  - `pnpm i18n-check`
  - `pnpm nx run renderer:build`

## Exit Criteria

- `BL-028` remaining scope closed and status moved to `Done`.
- `BL-029` implementation design agreed and initial artifact-based implementation landed.
- `BL-020` moved from `Proposed` to `Planned` or `Done` with tracked remaining scope.
- CI remains green on PR and post-merge paths.

## Progress Log

- 2026-02-13: Sprint 3 initialized to focus only on remaining backlog items after Sprint 2 completion.
