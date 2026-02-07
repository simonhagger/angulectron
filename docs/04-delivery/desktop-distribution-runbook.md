# Desktop Distribution Runbook

## Packaging

- Build renderer + desktop main + desktop preload.
- Package via Electron Forge makers.
- Verify artifact smoke set:
  - `dist/apps/desktop-main/main.js`
  - `dist/apps/desktop-preload/main.js`
  - `dist/apps/renderer/browser/index.html`

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

## Staged Rollout

- Release to `dev`, then `beta`, then `stable`.
- Monitor telemetry and error logs between promotions.
