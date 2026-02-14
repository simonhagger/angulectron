# Python Runtime Bundle

Default model:

- `pnpm run python-runtime:prepare-local` now prepares runtime from a pinned official artifact catalog:
  - `tools/python-runtime-artifacts.json`
- The script downloads the configured artifact, verifies SHA256, extracts it, applies runtime shaping, installs pinned runtime requirements, and writes:
  - `build/python-runtime/<platform>-<arch>/manifest.json`
- `pnpm run python-runtime:assert` enforces bundle validity and (by default) requires `source.kind = official-artifact`.

Runtime payload location:

- `build/python-runtime/<platform>-<arch>/`

Required file:

- `manifest.json`
- Runtime dependency spec file (tracked in repo):
  - `apps/desktop-main/python-sidecar/requirements-runtime.txt`

`manifest.json` shape:

```json
{
  "executableRelativePath": "python/python.exe",
  "pythonVersion": "3.13.5",
  "packages": [{ "name": "PyMuPDF", "version": "1.26.7" }]
}
```

Rules:

- `executableRelativePath` is relative to `build/python-runtime/<platform>-<arch>/`.
- The referenced executable must exist.
- Staging/production packaging runs `pnpm run python-runtime:assert` and fails if bundle files are missing/invalid or source policy is not satisfied.

Notes:

- Runtime binaries are intentionally not tracked in git.
- `desktop-main` build copies runtime payload into packaged artifacts under `python-runtime/<platform>-<arch>/`.

Commands:

- prepare bundle from pinned official artifact (default):
  - `pnpm run python-runtime:prepare-local`
- validate bundle:
  - `pnpm run python-runtime:assert`

Optional environment overrides:

- `PYTHON` -> explicit Python command to inspect.
- `PYTHON_RUNTIME_SOURCE_DIR` -> explicit folder to copy as runtime payload (local override, non-default).
- `PYTHON_RUNTIME_TARGET` -> override target folder (default `<platform>-<arch>`).
- `PYTHON_RUNTIME_REQUIREMENTS` -> override path to requirements file used for deterministic package install.
- `PYTHON_RUNTIME_PACKAGES` -> fallback comma-separated package names for manifest recording when no requirements file exists.
- `PYTHON_RUNTIME_ALLOW_UNOFFICIAL_SOURCE=1` -> allow assert pass for non-official source manifests (local emergency only).

The prepare script prunes non-runtime payload (docs/tests/demo assets) to keep package size down.
It also clears runtime `Lib/site-packages` and reinstalls pinned runtime dependencies from the requirements file for deterministic package contents.
