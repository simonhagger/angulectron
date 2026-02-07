# Observability And Diagnostics

Owner: Platform Engineering + SRE  
Review cadence: Quarterly  
Last reviewed: 2026-02-07

## Logging Strategy

- Structured JSON logs are required in main, preload, and renderer.
- Required fields: `timestamp`, `level`, `component`, `version`, `correlationId`, `event`.
- Log levels: `debug`, `info`, `warn`, `error`.
- User-facing text and internal diagnostics must be separated.
- Shared helper: `libs/util/common/src/lib/common.ts` (`toStructuredLogLine`).

Example:

```ts
const line = toStructuredLogLine({
  level: 'info',
  component: 'desktop-main',
  event: 'api.invoke',
  version: '1.0.0',
  correlationId: 'corr-123',
});
```

## Correlation Across Boundaries

- Every IPC request includes `correlationId`.
- Preload must generate a `correlationId` if caller does not supply one.
- Main process must preserve and return the same `correlationId` in failure envelopes.

## Error Taxonomy And Retry Policy

- Failure envelope: `{ code, message, details, retryable, correlationId }`.
- Namespaced codes must be used (`IPC/*`, `FS/*`, `API/*`, `STORAGE/*`).
- Timeout defaults:
  - External API operations: 8000 ms unless operation override is declared.
  - IPC handlers should fail fast on contract validation and avoid indefinite waits.
- Retry defaults:
  - Allowed for idempotent operations only (for this repo: `GET` API operations).
  - Default max attempts: 2 with bounded backoff/jitter.
  - Never retry non-idempotent operations by default (`POST` writes).
- UX-facing classification families:
  - `offline` (`API/OFFLINE`, `API/DNS_ERROR`, `API/PROXY_ERROR`)
  - `timeout` (`API/TIMEOUT`)
  - `auth` (`API/AUTH_REQUIRED`, `API/FORBIDDEN`)
  - `server` (`API/SERVER_ERROR`)
  - `validation` (`IPC/VALIDATION_FAILED`, `API/RESPONSE_PARSE_FAILED`)

## Retention And Storage

- Development: log to console and rotating local file.
- CI: attach logs to workflow artifacts for failing jobs.
- Release builds: retain local logs for 14 days with max size caps.

## Crash Reporting

- Capture: process type, version, stack traces, recent event metadata, correlation IDs.
- Exclude: secrets, raw credentials, full payload bodies, unredacted PII.
- Crash and diagnostic uploads must be opt-in where policy requires it.

## Privacy Constraints

- Never log tokens, credentials, or full personal data records.
- Redact sensitive fields before serialization.
- Telemetry and diagnostics schemas must classify fields as `public`, `internal`, `sensitive`, or `secret`.

## Related Standards

- Security review workflow: `docs/03-engineering/security-review-workflow.md`
- Definition of Done: `docs/05-governance/definition-of-done.md`
- IPC contract standard: `docs/02-architecture/ipc-contract-standard.md`
