# IPC Contract Standard

Owner: Platform Engineering  
Review cadence: Quarterly  
Last reviewed: 2026-02-13

## Contract Requirements

- Every request carries `contractVersion`.
- Every payload has a Zod schema in `libs/shared/contracts`.
- Every response is `DesktopResult<T>`.

## Channel Ownership

- Channel IDs live only in `channels.ts`.
- No ad-hoc channels in feature libraries.

## Versioning

- Breaking payload changes require contract version increment.
- Backward-compatible additions are additive and optional.

## Validation Policy

- Validate at preload request construction.
- Validate again at main process boundary.
- Return typed validation failures with `code`, `message`, `details`, `retryable`.

## Testing

- Contract schema tests for valid/invalid payloads.
- Main handler tests for rejection paths and happy paths.
