# Solution Architecture

Owner: Platform Engineering  
Review cadence: Quarterly  
Last reviewed: 2026-02-13

## High-Level Model

- `apps/renderer`: Angular standalone application shell.
- `apps/desktop-preload`: typed preload bridge.
- `apps/desktop-main`: BrowserWindow lifecycle and privileged handlers.
- `apps/desktop-main/src/assets/python_sidecar`: Python HTTP sidecar script for local privileged helper flows.
- `libs/shared/contracts`: IPC channels, schemas, and error envelopes.
- `libs/platform/desktop-api`: typed renderer API contract.

## Runtime Flow

1. Renderer calls `window.desktop.*`.
2. Preload validates and forwards to `ipcRenderer.invoke`.
3. Main validates against shared Zod schemas.
4. Main returns typed `DesktopResult<T>`.
5. Renderer updates signal state.

Python sidecar extension path:

1. Renderer selects a local file through typed desktop dialog APIs.
2. Preload forwards tokenized requests only (not raw file paths).
3. Main resolves scoped/expiring file tokens, validates type/signature, then calls local Python sidecar endpoint.
4. Main returns safe diagnostics only to renderer.

## Security By Design

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Whitelisted channels only.
- Renderer never receives raw bearer tokens or privileged parser execution capability.
- File parser pipelines are fail-closed on validation mismatch before sidecar execution.

## Deployment Shape

- Renderer static output in `dist/apps/renderer/browser`.
- Electron main/preload outputs in `dist/apps/desktop-*`.
- Python sidecar script copied into desktop-main build assets.
- Forge packaging through channel-specific workflows.
