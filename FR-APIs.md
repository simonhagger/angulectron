# Feature Request: Secure Internet API Calling Platform Capability

## Status (2026-02-07)

This capability is implemented as a governed platform service in `desktop-main` with operation-based invocation from renderer through preload.

## Implemented

- Operation-based API invocation (`operationId`, typed params) via IPC.
- Destination governance through operation registry in main process.
- HTTPS-only destination enforcement.
- Redirect policy: all redirects blocked.
- Bounded request behavior:
  - timeout enforcement
  - maximum response size checks
  - per-operation concurrency limits
  - per-operation interval throttling
- Retry policy:
  - idempotent operations only (`GET`)
  - bounded attempts + jittered backoff
  - non-idempotent operations (`POST`) are not retried by default
- Failure normalization with stable error codes and `correlationId`.
- Network classification for UX handling:
  - offline, DNS, proxy, TLS, timeout, auth/forbidden, rate-limited, server/client
- Credential boundary:
  - operation-level auth policy
  - bearer tokens sourced from environment only when configured
- Response handling:
  - successful responses must be JSON content type
  - JSON parsing errors are normalized

## Partially Implemented / Remaining

- Operation identifier typing is still string-based at compile time (runtime allowlist is enforced).
- Enterprise proxy/TLS inspection behavior is classified but not yet documented as an explicit support matrix.
- Offline queue/replay strategy is not implemented (current behavior is fail-fast with retryable classification where appropriate).

## Security Posture Summary

- Renderer cannot issue arbitrary URLs through platform API surface.
- Renderer cannot force credential attachment outside configured operations.
- Hostile responses are treated as untrusted input and bounded.

## Verification Commands

- `pnpm nx run desktop-main:test`
- `pnpm nx run desktop-main:build`
- `pnpm nx run contracts:test`

## References

- Main gateway: `apps/desktop-main/src/api-gateway.ts`
- Main IPC wiring: `apps/desktop-main/src/main.ts`
- Preload bridge: `apps/desktop-preload/src/main.ts`
- Contracts: `libs/shared/contracts/src/lib/api.contract.ts`
- Channel registry: `libs/shared/contracts/src/lib/channels.ts`
