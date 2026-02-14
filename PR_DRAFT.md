## Summary

- What changed:
  - Stabilized auth/session lifecycle behavior in Auth Session Lab and preload/main refresh timing.
  - Refactored OIDC provider HTTP/discovery concerns into a dedicated provider client module.
  - Hardened production frontend surface by excluding lab routes/navigation from production bundles.
  - Added a deterministic bundled demo update cycle (`v1` -> `v2` patch) for end-to-end update model proof.
  - Established renderer i18n migration pattern on Home using feature-local locale assets with merged transloco loading.
  - Consolidated renderer route + nav metadata into a single typed registry (`BL-021`).
  - Improved shell sidenav UX with adaptive width and interaction-driven scrollbar visibility.
  - Updated governance backlog statuses to reflect completed sprint work and newly delivered hardening items.
- Why this change is needed:
  - Remove auth startup inconsistencies/timeouts and incorrect auth-lab redirect behavior.
  - Ensure production does not expose hidden lab routes/features in bundle/runtime UI.
  - Provide a provable update mechanism demo path independent of installer-native updater infrastructure.
  - Reduce frontend duplication/drift between router and nav shell configuration.
  - Prove i18n migration mechanics before real feature-page rollout.
- Risk level (low/medium/high):
  - Medium (touches desktop main/preload/contracts/renderer and IPC channels)

## Change Groups

- Docs / Governance:
  - Backlog updated to mark completed items (`BL-003`, `BL-012`, `BL-015`, `BL-016`, `BL-017`, `BL-018`, `BL-023`, `BL-025`) and add `BL-026`/`BL-027`.
  - Backlog updated to mark `BL-021` complete and sprint log updated with delivery notes.
- Frontend / UX:
  - Auth Session Lab now reports real initialization failures and preserves in-place navigation when launched directly.
  - Updates page now shows source/version diagnostics and supports `Apply Demo Patch` when source is `demo`.
  - Production build now excludes lab routes/nav entries and hides labs toggle behavior.
  - Home page now consumes i18n keys with component-local `i18n/en-US.json` and runtime-safe string lookups.
  - Shell menu now scales wider on large breakpoints and hides scrollbars unless hover/focus interaction is present.
- Desktop Main / Preload / Contracts:
  - Extracted OIDC discovery/timeout request behavior from `oidc-service.ts` into `oidc-provider-client.ts` (behavior-preserving refactor for `BL-019` first slice).
  - Added `DemoUpdater` with deterministic baseline seeding on launch and SHA-256 validated patch apply.
  - Added IPC channel `updates:apply-demo-patch`.
  - Extended update contracts and desktop API typing with source/version/demo path metadata.
  - Updates handler falls back to bundled demo updater when `app-update.yml` is not present.
- CI / Tooling:
  - No workflow changes in this batch.

## Validation

- [x] `pnpm nx run contracts:test`
- [x] `pnpm nx run desktop-main:test`
- [x] `pnpm nx run renderer:build`
- [x] `pnpm nx run desktop-main:build`
- [x] Additional checks run:
  - `pnpm nx run desktop-preload:test`
  - `pnpm nx run desktop-preload:build`
  - `pnpm nx run contracts:build`
  - `pnpm nx run renderer:test`
  - `pnpm i18n-check`
  - `pnpm nx run renderer:build:development` (post-i18n and shell/nav changes)
  - `pnpm nx run renderer:build:production` (post-`BL-021` route/nav registry refactor)
  - `pnpm nx run renderer:lint` (existing unrelated warning only)
  - `pnpm nx run desktop-main:test` (post-`BL-019` extraction)
  - `pnpm nx run desktop-main:build` (post-`BL-019` extraction)
  - Manual smoke: update check verified from Home and Updates page.
  - Manual smoke: demo patch apply verified (`1.0.0-demo` -> `1.0.1-demo`) and deterministic reset after restart verified.
  - Manual smoke: auth login lifecycle verified after OIDC provider-client extraction.
  - Manual smoke: sidenav routing verified and scrollbar hidden-state behavior validated.

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
  - N/A for this increment (no new external network trust boundary introduced; demo update feed/artifact are local bundled files under app-managed userData path).
- N/A rationale (when no threat model update is needed):
  - New functionality remains behind existing privileged IPC boundary checks.
  - Demo patch path validates artifact integrity (sha256) and writes only to deterministic local demo file path.
  - No executable code loading or dynamic plugin hot-swap introduced.
