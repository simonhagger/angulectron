# Reliability And Error Handling

Owner: Platform Engineering  
Review cadence: Quarterly  
Last reviewed: 2026-02-07

## Standard Error Envelope

All privileged boundaries return the same failure shape:

`{ code, message, details, retryable, correlationId }`

Rules:

- `code` is for machines and automation.
- `message` is safe, user-facing or operator-facing text.
- `details` is diagnostic context and must exclude secrets.
- `retryable` indicates whether automated retry is allowed.
- `correlationId` must be preserved across renderer -> preload -> main.

## Retry And Timeout Policy

- Contract validation failures fail immediately (no retries).
- External API default timeout: 8000 ms.
- Retry is allowed only for idempotent operations.
- Default retry attempts: 2 with bounded backoff and jitter.
- Non-idempotent operations are never retried by default.

## Operations Never Retried

- Storage writes (`storage:set-item`, `storage:delete-item`, `storage:clear-domain`)
- Non-idempotent API operations (`POST`)
- User-dialog mediated file reads (`dialog:open-file`, `fs:read-text-file`)

## Failure UX Patterns

- Transient failure toast:
  - for retryable network failures (`offline`, `timeout`, `rate-limited`)
  - includes short guidance text and retry action
- Blocking error dialog:
  - for security policy blocks or unrecoverable startup/storage failures
  - includes correlation ID and support guidance
- Inline field errors:
  - for validation/input errors where user can immediately correct data
- Offline banner:
  - shown while network classification indicates offline/proxy/DNS issues
  - hidden automatically when connectivity recovers

## Crash Recovery Guidance

- Cache domain values are TTL-bound and may be safely rehydrated.
- Durable settings persist until explicit reset/clear flow.
- If storage integrity check fails, app enters safe failure mode and prompts recovery/reset.
- Renderer crash recovery may auto-reload only when no destructive flow is in progress.

## Related Standards

- Observability and diagnostics: `docs/03-engineering/observability-and-diagnostics.md`
- Security review workflow: `docs/03-engineering/security-review-workflow.md`
- Definition of Done: `docs/05-governance/definition-of-done.md`
- CI checks: `.github/workflows/ci.yml`
