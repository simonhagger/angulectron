# Security Architecture

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

## Secrets

- Do not commit secrets.
- Use environment-based secrets in CI/release contexts.
