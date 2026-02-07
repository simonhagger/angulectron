# Desktop Distribution Runbook

## Packaging

- Build renderer + desktop main + desktop preload.
- Package via Electron Forge makers.

## Signing Readiness

- Keep signing cert secrets in CI secret storage.
- Validate signature in pre-release smoke tests.

## Validation Checklist

- Installer launches app successfully on target OS.
- Auto-update check path resolves correctly.
- File dialog and preload bridge behaviors function post-install.

## Staged Rollout

- Release to `dev`, then `beta`, then `stable`.
- Monitor telemetry and error logs between promotions.
