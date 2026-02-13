## Summary

- What changed:
- Why this change is needed:
- Risk level (low/medium/high):

## Change Groups

- Docs / Governance:
- Frontend / UX:
- Desktop Main / Preload / Contracts:
- CI / Tooling:

## Validation

- [ ] `pnpm nx run contracts:test`
- [ ] `pnpm nx run desktop-main:test`
- [ ] `pnpm nx run renderer:build`
- [ ] `pnpm nx run desktop-main:build`
- [ ] Additional checks run:

## Engineering Checklist

- [ ] Conventional Commit title used
- [ ] Unit/integration tests added or updated
- [ ] A11y impact reviewed
- [ ] I18n impact reviewed
- [ ] IPC contract changes documented
- [ ] ADR added/updated for architecture-level decisions

## Security (Required For Sensitive Changes)

IMPORTANT:

- If this PR touches `apps/desktop-main/**`, `apps/desktop-preload/**`, `libs/shared/contracts/**`, `.github/workflows/**`, or `docs/02-architecture/security-architecture.md`, the two items below MUST be checked to pass CI.

- [ ] Security review completed
- [ ] Threat model updated or N/A explained

### Security Notes

- Threat model link/update:
- N/A rationale (when no threat model update is needed):
