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

- Runtime selection prefers bundled Python payload when present; local/dev can still fall back to system Python (`3.11+`) for experimentation.
- Packaged builds do not fall back to system Python; bundled runtime is required.
- If no valid runtime is available, sidecar-dependent features must fail with typed diagnostics and not crash desktop startup.
- Staging builds keep lab routes enabled for verification; production builds strip lab routes/features from bundle surface.
- Deterministic packaged builds expect a local bundled runtime payload:
  - `build/python-runtime/<platform>-<arch>/manifest.json`
  - sidecar dependency pin file: `apps/desktop-main/python-sidecar/requirements-runtime.txt`
  - staging/production packaging preflight: `pnpm run python-runtime:assert`
  - preflight validates runtime interpreter and `fitz` import when PyMuPDF is declared
  - runtime payload copied into `dist/apps/desktop-main/python-runtime/<platform>-<arch>/` via `pnpm run python-runtime:sync-dist`

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
