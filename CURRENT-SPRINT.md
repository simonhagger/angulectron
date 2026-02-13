# Current Sprint

Sprint window: 2026-02-13 onward (Sprint 2)  
Owner: Platform Engineering + Security + Frontend  
Status: Active (core scope complete; stretch pending)

## Sprint Goal

Advance post-refactor hardening by improving auth lifecycle completeness, IPC integration confidence, and API contract typing safety.

## In Scope (Committed)

- `BL-015` Add IdP global sign-out and token revocation flow.
- `BL-023` Expand IPC integration harness for preload-main real handler paths.
- `BL-025` Strengthen compile-time typing for API operation contracts end-to-end.

## Stretch Scope (If Capacity Allows)

- `BL-020` Complete renderer i18n migration for hardcoded user-facing strings.

## Additional Delivered Work (Unplanned but Completed)

- Production hardening: exclude lab routes/navigation from production bundle surface.
- Update model proof: deterministic bundled-file demo patch cycle (`v1` to `v2`) with integrity check and UI diagnostics.

## Out Of Scope (This Sprint)

- `BL-019`, `BL-022`, `BL-024`.

## Execution Plan (Coherent + Individually Testable)

### Workstream A: `BL-015` auth sign-out completeness

1. `BL-015A` Implement explicit sign-out mode handling in main auth service.

- Scope: introduce local-only vs provider/global sign-out behavior, including revocation/end-session where supported by IdP metadata/config.
- Done when: sign-out path can deterministically return local clear success and provider sign-out status without exposing secrets.
- Proof:
  - `pnpm nx run desktop-main:test`
  - `pnpm nx run desktop-main:build`

2. `BL-015B` Surface sign-out mode + outcome through preload and renderer UX.

- Scope: extend preload/renderer flow to request mode and render user-safe outcomes (local cleared, provider signed out, provider not supported).
- Done when: Auth Session Lab can execute both paths and show accurate status transitions.
- Proof:
  - `pnpm nx run renderer:test`
  - `pnpm nx run renderer:build`

### Workstream B: `BL-023` IPC integration hardening

3. `BL-023A` Add unauthorized sender integration tests with real handlers.

- Scope: test real handler registration path rejects wrong window/frame sender consistently across privileged channels.
- Done when: unauthorized sender rejection is covered by integration tests, not only unit-level wrapper tests.
- Proof:
  - `pnpm nx run desktop-main:test`

4. `BL-023B` Add correlation-id and timeout propagation integration tests.

- Scope: verify correlation-id continuity and timeout envelope behavior across preload invoke client and main IPC handlers.
- Done when: tests assert stable error codes/correlation behavior for timeout and malformed/failed invoke cases.
- Proof:
  - `pnpm nx run desktop-main:test`
  - `pnpm nx run desktop-preload:build`

### Workstream C: `BL-025` API typing end-to-end

5. `BL-025A` Introduce operation-to-request/response type map in contracts.

- Scope: define typed operation map and export helper types for operation params/result payloads.
- Done when: operations can be referenced by key with compile-time request/response inference.
- Proof:
  - `pnpm nx run contracts:test`
  - `pnpm nx run contracts:build`

6. `BL-025B` Consume typed operation map in preload + main API gateway interfaces.

- Scope: remove stringly-typed call sites in preload and gateway boundaries where operation payload types can be inferred.
- Done when: `desktop.api.invoke` and main gateway wiring compile with mapped operation types and unchanged runtime behavior.
- Proof:
  - `pnpm nx run desktop-preload:build`
  - `pnpm nx run desktop-main:test`
  - `pnpm nx run renderer:build`

### Cross-cut verification gate (after each merged unit)

- `pnpm unit-test`
- `pnpm integration-test`
- `pnpm runtime:smoke`

## Exit Criteria

- `BL-015`, `BL-023`, and `BL-025` merged through PR workflow with security checklist completed.
- Existing CI quality gates remain green.
- Docs updated for any changed contracts/flows.

## Progress Log

- 2026-02-13: Sprint 1 closure confirmed (`BL-016`, `BL-017`, `BL-018` complete with cross-cut verification).
- 2026-02-13: Sprint 2 initialized with committed scope (`BL-015`, `BL-023`, `BL-025`) and stretch (`BL-020`).
- 2026-02-13: Completed `BL-015A` by introducing explicit sign-out mode (`local` or `global`) and detailed sign-out outcomes in auth contracts, desktop-main service flow, and IPC handling.
- 2026-02-13: Completed `BL-015B` baseline by propagating sign-out mode through preload and Auth Session Lab UX with separate local/global controls and provider outcome messaging.
- 2026-02-13: Completed `BL-023A` by adding real-handler unauthorized-sender integration coverage in `apps/desktop-main/src/ipc/register-ipc-handlers.spec.ts`.
- 2026-02-13: Completed `BL-023B` by adding preload invoke-client tests for malformed responses, timeout behavior, and invoke failures with correlation-id assertions (`apps/desktop-preload/src/invoke-client.spec.ts`) and wiring `desktop-preload:test` target.
- 2026-02-13: Completed `BL-025A` and `BL-025B` baseline by adding operation type maps in contracts and consuming typed operation params/result signatures in desktop API/preload invoke surfaces.
- 2026-02-13: Auth lifecycle stabilization pass completed: bounded OIDC network timeouts in main auth service, auth-page initialization now surfaces true IPC errors, token diagnostics sequencing fixed to avoid startup race, and auth-lab redirect behavior corrected to honor only explicit external `returnUrl`.
- 2026-02-13: Production hardening completed by replacing production route/shell config to exclude lab routes and lab navigation/toggle from production artifacts.
- 2026-02-13: Added bundled update demo proof flow: app startup seeds local runtime demo file to `1.0.0-demo`, update check detects bundled `1.0.1-demo`, apply action validates sha256 and overwrites local demo file, and renderer surfaces source/version/path diagnostics.
- 2026-02-13: Completed `BL-021` by adding a typed renderer route registry (`app-route-registry.ts`) that derives both `app.routes.ts` and `APP_SHELL_CONFIG.navLinks`, removing duplicated route/nav metadata while retaining production route/shell file replacements.
