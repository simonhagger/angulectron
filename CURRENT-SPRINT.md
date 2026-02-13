# Current Sprint

Sprint window: 2026-02-13 onward  
Owner: Platform Engineering + Frontend  
Status: Active

## Sprint Goal

Reduce risk in privileged runtime boundaries by completing the P0 refactor set while preserving existing behavior.

## In Scope (Committed)

- `BL-016` Refactor desktop-main composition root and IPC modularization.
- `BL-017` Refactor preload bridge into domain modules with shared invoke client.
- `BL-018` Introduce reusable validated IPC handler factory in desktop-main.

## Stretch Scope (If Capacity Allows)

- `BL-023` Expand IPC integration harness for preload-main real handler paths.
- `BL-025` Strengthen compile-time typing for API operation contracts end-to-end.

## Out Of Scope (This Sprint)

- `BL-019`, `BL-020`, `BL-021`, `BL-022`, `BL-024`.

## Execution Plan (Coherent + Individually Testable)

### Workstream A: `BL-016` desktop-main modularization

1. `BL-016A` Extract non-IPC concerns from `apps/desktop-main/src/main.ts`.

- Scope: move window creation, navigation hardening, environment/version resolution, and runtime-smoke setup into dedicated modules.
- Done when: `main.ts` is composition-focused and behavior remains unchanged.
- Proof:
  - `pnpm nx build desktop-main`
  - `pnpm nx test desktop-main`

2. `BL-016B` Extract IPC handlers into per-domain modules.

- Scope: move handlers into `ipc/handlers/*` while retaining channel and response behavior.
- Done when: handler registration is centralized and each domain handler is isolated.
- Proof:
  - `pnpm nx build desktop-main`
  - `pnpm nx test desktop-main`

### Workstream B: `BL-018` validated handler factory

3. `BL-018A` Add reusable handler wrapper.

- Scope: create shared factory for sender authorization + schema validation + typed failure envelope mapping.
- Done when: at least handshake/app/auth handlers use factory with no behavior drift.
- Proof:
  - `pnpm nx test desktop-main`
  - `pnpm nx build desktop-main`

4. `BL-018B` Migrate remaining handlers to wrapper.

- Scope: migrate dialog/fs/storage/api/updates/telemetry handlers.
- Done when: all privileged handlers use one validation/authorization path.
- Proof:
  - `pnpm nx test desktop-main`
  - `pnpm nx build desktop-main`

### Workstream C: `BL-017` preload modularization

5. `BL-017A` Extract invoke client core.

- Scope: move correlation-id generation, timeout race handling, result parsing, and error mapping into shared `invoke` module.
- Done when: existing namespaces call shared invoke core.
- Proof:
  - `pnpm nx build desktop-preload`
  - `pnpm nx build desktop-main`

6. `BL-017B` Split preload API by domain.

- Scope: split app/auth/dialog/fs/storage/api/updates/telemetry methods into domain modules and compose into exported `desktopApi`.
- Done when: `apps/desktop-preload/src/main.ts` becomes thin composition only.
- Proof:
  - `pnpm nx build desktop-preload`
  - `pnpm nx build desktop-main`

### Cross-cut verification gate (after each merged unit)

- `pnpm unit-test`
- `pnpm integration-test`
- `pnpm runtime:smoke`

## Exit Criteria

- P0 items merged through PR workflow with no security model regressions.
- Existing CI quality gates remain green.
- Docs updated for any changed project structure or conventions.

## Progress Log

- 2026-02-13: Sprint initialized from governance backlog with P0 focus (`BL-016`, `BL-017`, `BL-018`).
- 2026-02-13: Added PR-sized execution breakdown with per-unit proof commands.
