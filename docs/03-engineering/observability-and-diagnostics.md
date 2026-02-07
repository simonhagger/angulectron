# Observability And Diagnostics

Owner: Platform Engineering + SRE  
Review cadence: Quarterly  
Last reviewed: 2026-02-07

## Logging Strategy

- Structured JSON logs are required in main, preload, and renderer.
- Required fields: `timestamp`, `level`, `component`, `version`, `correlationId`, `event`.
- Log levels: `debug`, `info`, `warn`, `error`.
- User-facing text and internal diagnostics must be separated.

## Correlation Across Boundaries

- Every IPC request includes `correlationId`.
- Preload must generate a `correlationId` if caller does not supply one.
- Main process must preserve and return the same `correlationId` in failure envelopes.

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
