# Current Sprint

Owner: Platform Engineering + Security  
Review cadence: Weekly  
Last reviewed: 2026-02-15  
Sprint window: 2026-02-14 onward (Sprint 4)  
Status: Active

## Sprint Goal

Increase security and runtime determinism in privileged execution paths before additional feature expansion.

## In Scope (Committed, Highest Value First)

- `BL-028` Enforce robust file signature validation parity across all privileged ingress paths.
- `BL-033` Centralize privileged file ingress policy across all IPC file routes.
- `BL-029` Standardize official Python runtime distribution for sidecar bundling (artifact + checksum + CI reproducibility).
- `BL-032` Standardize IPC handler failure envelope and correlation guarantees.

## Out of Scope (This Sprint)

- `BL-020` Renderer i18n uplift deferred while single-maintainer workflow remains.
- `BL-034` / `BL-035` i18n architecture enhancements deferred.
- `BL-038` sidecar transport ADR deferred unless risk profile changes.

## High-Value Intake From Backlog (Pass 2)

- `BL-039` Replace placeholder CODEOWNERS entries with real maintainers.
  - Rationale: highest governance/security leverage with low implementation risk; directly improves review accountability.
  - Fit: can be completed in parallel with current sprint without changing runtime behavior.
- `BL-042` Define and enforce TypeScript coverage thresholds in CI.
  - Rationale: prevents silent quality regression after current security/runtime hardening.
  - Fit: best taken once `BL-028` / `BL-032` stabilization is complete to avoid noisy threshold churn.
- `BL-031` Refactor desktop-main composition root into focused runtime modules.
  - Rationale: high architecture value and aligns with maintainability of privileged runtime paths.
  - Fit: should start after current in-scope security/determinism items exit to avoid competing risk in `desktop-main`.

## Delivery Status (Current Sprint Scope)

- `BL-033` Centralized policy in active use across privileged file ingress handlers (`fs`, `python`, `settings import`) with shared rejection logging surface.
- `BL-028` Parity improved with explicit fail-closed settings import enforcement (`.json` only) and uniform reject diagnostics (`security.file_ingress_rejected`).
- `BL-029` remains in progress (`BL-029A` implemented; `BL-029B` CI reproducibility path still pending completion proof).
  - Update (2026-02-15): Windows artifact-publish path now enforces `python-runtime:prepare-local` + `python-runtime:assert` prior to packaging via `forge:make:ci:windows`; GitHub run confirmation pending next push.
- `BL-032` remains in progress (validated handler normalization delivered; remaining preload-main integration assertion closure pending).

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

1. `BL-033A` Shared ingress policy module

- Scope: introduce one shared policy for extension/signature/size validation and consume it from all privileged file ingress handlers.
- Proof:
  - `pnpm nx run desktop-main:test`
  - `pnpm nx run desktop-preload:build`

2. `BL-028A` Close parity gaps + fail-closed behavior

- Scope: remove remaining route-by-route differences, enforce consistent rejection semantics, and add structured security events.
- Proof:
  - `pnpm nx run desktop-main:test`
  - `pnpm docs-lint`

3. `BL-029A` Official artifact + checksum flow

- Scope: source Python runtime from pinned official artifact, verify checksum, and prepare deterministic runtime bundle inputs.
- Proof:
  - `pnpm run python-runtime:prepare-local`
  - `pnpm run python-runtime:assert`

4. `BL-029B` CI reproducible runtime assembly

- Scope: guarantee package builds use prepared runtime artifact path and pinned runtime requirements in CI.
- Proof:
  - `pnpm run build-desktop-main`
  - `pnpm forge:make:staging`

5. `BL-032A` IPC failure envelope normalization

- Scope: ensure validated handler factory normalizes validation and unexpected runtime failures into a single safe contract with correlation IDs.
- Proof:
  - `pnpm nx run desktop-main:test`
  - `pnpm nx run desktop-preload:test`

## Exit Criteria

- `BL-028` and `BL-033` moved to `Done` once remaining parity audit confirms no uncovered privileged ingress routes.
- `BL-029` moved to `Done` or `In Progress` with artifact/checksum path merged and CI proof complete.
- `BL-032` moved to `Done` with integration test coverage proving envelope consistency.
- CI remains green on PR and post-merge paths.

## Progress Log

- 2026-02-14: Sprint reprioritized to security/runtime determinism; i18n work deferred.
- 2026-02-14: Implemented shared file token consumption and centralized ingress policy (`BL-033` / `BL-028` progress) with new handler tests and successful `desktop:dev:win` verification.
- 2026-02-14: Implemented validated handler exception normalization (`BL-032` progress): unexpected sync/async handler failures now return `IPC/HANDLER_FAILED` with correlation IDs and structured logging.
- 2026-02-14: Started `BL-029A` implementation: added pinned official Python artifact catalog + SHA256 verification flow in runtime prep/assert scripts, regenerated runtime bundle from official source, and validated `python-runtime:assert` + `build-desktop-main`.
- 2026-02-15: Backlog intake completed from independent refactor review; new governance/quality candidates (`BL-039` to `BL-045`) added to backlog and triaged for sprint-fit.
- 2026-02-15: Implemented centralized ingress rejection telemetry across `fs`, `python`, and `settings import` handlers (`security.file_ingress_rejected`) with correlation IDs and normalized policy/reason details.
- 2026-02-15: Added fail-closed settings import ingress enforcement via shared policy (`settingsJsonImport`, `.json` only) and test coverage for feature/runtime import rejection paths.
- 2026-02-15: Validation completed for this slice: `pnpm nx run desktop-main:test`, `pnpm nx run desktop-preload:build`, plus manual smoke logs confirming uniform reject-event shape across handlers.
- 2026-02-15: Implemented `BL-029B` CI packaging hardening by adding explicit Windows artifact pipeline runtime preparation and assertion (`forge:make:ci:windows` with `PYTHON_RUNTIME_TARGET=win32-x64`) before packaging.
- 2026-02-15: Local validation for `BL-029B` path completed: `pnpm run python-runtime:prepare-local`, `pnpm run python-runtime:assert`, `pnpm run build-desktop-main`, `pnpm docs-lint`.
