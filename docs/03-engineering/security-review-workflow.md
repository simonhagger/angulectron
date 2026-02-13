# Security Review Workflow

Owner: Security + Platform Engineering  
Review cadence: Quarterly  
Last reviewed: 2026-02-13

## Trigger Conditions (Mandatory)

Security review is required for any change that introduces or modifies:

- privileged IPC channels
- native modules
- new filesystem access paths
- external API allowlist destinations
- Electron `webPreferences`, sandbox settings, or CSP controls
- updater/signing/distribution controls

## Minimum Review Artifacts

- Updated IPC/API/storage contract.
- Mini threat model:
  - assets
  - trust boundaries
  - misuse/abuse cases
- Verification checklist and test evidence.

## Threat Model Template (Mini)

- Asset: what is protected.
- Actor: who might attack.
- Entry point: channel/boundary.
- Abuse case: what could go wrong.
- Control: mitigation in code/config.
- Verification: tests or review evidence.

## Baseline Hardening Checklist

### BrowserWindow and renderer boundary

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `enableRemoteModule: false`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- `experimentalFeatures: false` unless explicitly approved
- `setWindowOpenHandler` blocks untrusted popups by default
- `will-navigate` policy blocks non-allowlisted navigation

### Preload bridge boundary

- Expose minimal methods via `contextBridge.exposeInMainWorld`
- Do not expose raw `ipcRenderer`
- Use explicit allowlisted channels only
- Do not accept user-provided channel names
- Validate inputs in preload and re-validate in main

### IPC and privileged operations

- Use `ipcMain.handle`/`ipcRenderer.invoke` for request-response flows
- Validate every request payload with shared schemas
- Verify sender identity/authorized window for each privileged handler
- Avoid arbitrary filesystem path operations; enforce normalization and scoping
- Avoid unrestricted process execution; use explicit allowlists and argument validation
- Return minimal data needed by renderer

### File ingress and parser pipelines

- Enforce dual file-type checks before privileged parsing/execution:
  - extension allowlist
  - file signature/magic-byte verification
- Use tokenized file handles (expiring + sender-window scoped) between renderer and main.
- Reject mismatches with typed failure codes and fail closed.
- Log mismatch events without leaking raw sensitive content.

### Local helper services (for example Python sidecar)

- Bind helper service to loopback only.
- Validate all helper requests in main process first; helper must not become primary policy gate.
- Keep helper API surface minimal and operation-specific.
- Ensure stop/start lifecycle is deterministic and observable in diagnostics.

### Logging and secret handling

- Preserve `correlationId` across renderer -> preload -> main
- Use namespaced error codes (`IPC/*`, `FS/*`, `API/*`, `STORAGE/*`)
- Redact tokens, credentials, and sensitive identifiers from logs/telemetry
- Ensure failure envelopes are safe for user/operator visibility

### Packaging and release

- Validate signer/update channel configuration for affected release changes
- Confirm security-sensitive changes are covered by CI gates and evidence artifacts

### BYO secure endpoint pattern (`call.secure-endpoint`)

- Endpoint target must be configured through environment, never hardcoded:
  - `API_SECURE_ENDPOINT_URL_TEMPLATE`
  - optional `API_SECURE_ENDPOINT_CLAIM_MAP` (JSON map of `placeholder -> jwt.claim.path`)
- Endpoint URL must be `https://` only.
- URL placeholders use `{{placeholder}}` and resolve in this order:
  - request params supplied by renderer
  - mapped JWT claim value from `API_SECURE_ENDPOINT_CLAIM_MAP`
- Renderer-provided headers are allowlisted to `x-*` names only; privileged headers (for example `Authorization`) are not overridable.
- OIDC bearer token is attached in main process only; renderer never receives token material.
- Failure behavior must be typed and explicit:
  - missing env config -> `API/OPERATION_NOT_CONFIGURED`
  - missing path placeholder values -> `API/INVALID_PARAMS`
  - unsafe headers -> `API/INVALID_HEADERS`
- Review evidence for this pattern should include:
  - unit test for JWT claim mapping into path placeholders
  - unit test for unsafe header rejection
  - unit test for unconfigured operation behavior
  - one runtime smoke/e2e check that launch has no console/page errors

Review evidence for file-ingress/helper-runtime patterns should include:

- unit/integration tests for token expiry and token scope mismatch rejection
- unit/integration tests for extension mismatch rejection
- unit/integration tests for signature mismatch rejection
- helper-runtime tests for endpoint misuse/negative path handling

Reference implementation:

- `apps/desktop-main/src/api-gateway.ts`
- `libs/shared/contracts/src/lib/api.contract.ts`
- `apps/desktop-preload/src/main.ts`
- `apps/renderer/src/app/features/api-playground/api-playground-page.ts`

## Review Checklist Gate

- PR template must include a security section for triggered changes.
- Reviewer must explicitly confirm:
  - least-privilege boundary is maintained
  - error handling avoids sensitive leakage
  - logs/telemetry redact sensitive data
  - tests cover misuse/negative paths
