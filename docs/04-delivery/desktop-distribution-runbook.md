# Desktop Distribution Runbook

Owner: Release Engineering + Platform Engineering  
Review cadence: Quarterly  
Last reviewed: 2026-02-13

## Packaging

- Build renderer + desktop main + desktop preload.
- Package via Electron Forge makers.
- Verify artifact smoke set:
  - `dist/apps/desktop-main/main.js`
  - `dist/apps/desktop-preload/main.js`
  - `dist/apps/renderer/browser/index.html`
  - `dist/apps/desktop-main/apps/desktop-main/src/assets/python_sidecar/service.py`

Python sidecar notes:

- Current lab implementation runs with system Python (`3.11+`) and does not yet bundle a Python interpreter.
- If Python is unavailable on target machine, sidecar-dependent lab features must fail with typed diagnostics and not crash desktop startup.

## Signing Readiness

- Keep signing cert secrets in CI secret storage.
- Validate signature in pre-release smoke tests.
- macOS signing/notarization env vars:
  - `APPLE_CODESIGN_IDENTITY`
  - `APPLE_TEAM_ID`
  - `APPLE_ID`
  - `APPLE_APP_SPECIFIC_PASSWORD`

## Validation Checklist

- Installer launches app successfully on target OS.
- Auto-update check path resolves correctly.
- File dialog and preload bridge behaviors function post-install.
- Sidecar diagnostics path works when Python is installed.
- Sidecar diagnostics path fails safely (typed error) when Python is unavailable.

## Staged Rollout

- Release to `dev`, then `beta`, then `stable`.
- Monitor telemetry and error logs between promotions.
