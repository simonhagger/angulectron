## Summary

- What changed:
  - Added runtime settings management across renderer, preload, and main with feature-scoped and full-config import/export flows.
  - Migrated runtime configuration guidance to JSON-based runtime settings and removed `.env`-style tracked workflow.
  - Hardened privileged file ingress with centralized policy checks and uniform `security.file_ingress_rejected` telemetry.
  - Closed IPC failure-envelope normalization with integration assertions proving `IPC/HANDLER_FAILED` behavior and correlation preservation.
  - Hardened Windows artifact packaging path to enforce `python-runtime:prepare-local` + `python-runtime:assert` before Forge packaging.
  - Expanded Playwright smoke coverage for key UI behavior paths (labs toggle persistence, settings navigation, console-clean navigation).
  - Updated governance docs/backlog/sprint status to reflect delivered Sprint 4 items and added next extensibility/security architecture items.
- Why this change is needed:
  - Improve deterministic runtime behavior and security posture at privileged boundaries.
  - Reduce configuration drift and simplify user/operator setup for packaged builds.
  - Increase regression detection for frontend behavior with non-fragile E2E checks.
  - Keep governance artifacts aligned with implementation state.
- Risk level (low/medium/high):
  - Medium (touches desktop-main IPC handling, preload invoke behavior, CI packaging workflow, and E2E coverage)

## Change Groups

- Runtime Settings + Config:
  - Added settings IPC handlers/store integration and renderer settings panels (App/API/Auth).
  - Standardized runtime config path/model around JSON runtime document and in-app settings management.
- Security + IPC:
  - Added shared ingress policy coverage for settings imports and standardized rejection logging.
  - Added integration tests for real-handler throw path and preload preservation of `IPC/HANDLER_FAILED`.
- CI / Packaging:
  - Added `forge:make:ci:windows` script and wired artifact publish to explicit runtime prep/assert path.
- Frontend E2E:
  - Added Playwright checks for labs toggle/nav behavior persistence and settings panel route behavior.
  - Extended no-console-error smoke path beyond initial load.
- Governance:
  - Updated backlog and current sprint to mark `BL-028`, `BL-032`, `BL-033` done and capture newly proposed architecture items (`BL-046`–`BL-050`).

## Validation

- [x] `pnpm docs-lint`
- [x] `pnpm nx run desktop-main:test`
- [x] `pnpm nx run desktop-preload:test`
- [x] `pnpm nx run desktop-preload:build`
- [x] `pnpm e2e-smoke`
- [x] `pnpm run python-runtime:prepare-local`
- [x] `pnpm run python-runtime:assert`
- [x] `pnpm run build-desktop-main`
- [ ] `pnpm forge:make:staging` (not run locally in this batch)

## Engineering Checklist

- [x] Conventional Commit title used
- [x] Unit/integration tests added or updated
- [x] A11y impact reviewed
- [x] I18n impact reviewed
- [x] IPC contract changes documented
- [ ] ADR added/updated for architecture-level decisions

## Security (Required For Sensitive Changes)

IMPORTANT:

- If this PR touches `apps/desktop-main/**`, `apps/desktop-preload/**`, `libs/shared/contracts/**`, `.github/workflows/**`, or `docs/02-architecture/security-architecture.md`, the three items below MUST be checked to pass CI.

- [x] Security review completed
- [x] Threat model updated or N/A explained
- [x] Confirmed no secrets/sensitive data present in committed files

### Security Notes

- Threat model link/update:
  - N/A for this increment (no new external trust boundary introduced; hardening is within existing privileged IPC + packaging flow).
- N/A rationale (when no threat model update is needed):
  - Changes strengthen fail-closed behavior and observability for existing trust boundaries.
  - Runtime packaging enforcement validates pinned artifact provenance before packaging.
  - No renderer expansion of privileged capabilities; all operations remain main-process mediated.
