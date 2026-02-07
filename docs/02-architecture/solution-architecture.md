# Solution Architecture

## High-Level Model

- `apps/renderer`: Angular standalone application shell.
- `apps/desktop-preload`: typed preload bridge.
- `apps/desktop-main`: BrowserWindow lifecycle and privileged handlers.
- `libs/shared/contracts`: IPC channels, schemas, and error envelopes.
- `libs/platform/desktop-api`: typed renderer API contract.

## Runtime Flow

1. Renderer calls `window.desktop.*`.
2. Preload validates and forwards to `ipcRenderer.invoke`.
3. Main validates against shared Zod schemas.
4. Main returns typed `DesktopResult<T>`.
5. Renderer updates signal state.

## Security By Design

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Whitelisted channels only.

## Deployment Shape

- Renderer static output in `dist/apps/renderer/browser`.
- Electron main/preload outputs in `dist/apps/desktop-*`.
- Forge packaging through channel-specific workflows.
