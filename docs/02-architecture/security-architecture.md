# Security Architecture

Owner: Platform Engineering + Security  
Review cadence: Quarterly  
Last reviewed: 2026-02-13

## Electron Hardening Baseline

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `enableRemoteModule: false`
- No untrusted remote content loaded in production.

## Renderer Security

- Treat renderer input as untrusted.
- Sanitize data rendered from file/API input.
- No direct filesystem or shell access from renderer.

## Preload Security

- Export minimal `window.desktop` API.
- Expose methods, not raw IPC primitives.
- Keep API stable and versioned.

## Main Process Security

- Validate every request payload.
- Restrict file dialog and file operation scope.
- Log and classify failures with typed error envelopes.

## Local Helper Runtime Security (Python Sidecar)

- Treat Python sidecar as privileged local execution, not a renderer extension.
- Allow main-process invocation only through explicit IPC channels and validated envelopes.
- Use expiring, window-scoped file selection tokens; never accept renderer-supplied raw filesystem paths.
- Enforce fail-closed file guards before parser execution:
  - expected extension
  - expected file signature (magic/header bytes)
- Return minimal, non-sensitive diagnostics to renderer.
- Keep sidecar endpoint local-only (`127.0.0.1`) with no external bind.
- Do not trust sidecar process availability as a security boundary; main process remains policy enforcement point.

## Secrets

- Do not commit secrets.
- Use environment-based secrets in CI/release contexts.
