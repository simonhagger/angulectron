# Feature Request: Secure Local Application Storage Platform Capability

## Status (2026-02-07)

Core storage capability is implemented with SQLite-backed persistence in main process, typed IPC contracts, optional sensitive-data encryption, schema versioning, and retention behavior.

## Implemented

- Privileged storage boundary:
  - renderer accesses storage only via preload + IPC contracts
  - no direct DB/file primitives exposed to renderer
- SQLite-backed storage domain separation:
  - `settings` (durable)
  - `cache` (rebuildable)
- Classification support:
  - `internal`
  - `sensitive`
- Sensitive-at-rest encryption path:
  - uses Electron `safeStorage` when available
- Versioned schema management:
  - schema version recorded in metadata
  - deterministic migration from v1 to v2
  - incompatible future schema fails safely
- Retention behavior:
  - cache TTL support (`ttlSeconds`)
  - default cache TTL when not provided
  - expired entries pruned on read/startup
- Corruption/integrity handling:
  - startup integrity check (`PRAGMA quick_check`)
  - normalized corruption/init failure codes
- Stable typed operations:
  - `setItem`, `getItem`, `deleteItem`, `clearDomain`

## Partially Implemented / Remaining

- Capability-level access control model is not yet explicit (operations are typed but not role/capability scoped).
- Data classification levels beyond `internal`/`sensitive` are not yet implemented (`public`, `secret`, `high-value secret`).
- Dedicated phase-2 Local Vault capability is not implemented.
- Explicit user-facing storage recovery UX flows (reset/repair wizard) are still to be built.

## Security Posture Summary

- Renderer compromise is constrained to declared storage operations.
- Sensitive values are not persisted as plaintext when encryption is available.
- Compatibility and corruption failures are handled explicitly instead of silent fallback.

## Verification Commands

- `pnpm nx run desktop-main:test`
- `pnpm nx run desktop-main:build`
- `pnpm nx run contracts:test`

## References

- Storage gateway: `apps/desktop-main/src/storage-gateway.ts`
- Main IPC wiring: `apps/desktop-main/src/main.ts`
- Preload bridge: `apps/desktop-preload/src/main.ts`
- Contracts: `libs/shared/contracts/src/lib/storage.contract.ts`
- Channel registry: `libs/shared/contracts/src/lib/channels.ts`
