# Product Engineering Charter

## Mission

Deliver a secure, maintainable, and accessible desktop application platform using Angular 21 + Electron with predictable delivery quality.

## Non-Negotiables

- SOLID and DRY principles apply to every feature.
- No direct commits to `main`.
- Preload is the only renderer-to-OS bridge.
- IPC contracts are typed, versioned, and validated.
- WCAG 2.2 AA minimum and keyboard-first interaction.
- All user-facing text is translation-key based.

## Definition Of Quality

- Build, lint, typecheck, and tests pass in CI.
- Contract changes include schema updates and tests.
- Architecture changes include an ADR.
- Security controls follow Electron hardening standards.

## Team Operating Rules

- Trunk-based development with short-lived branches.
- Conventional Commits for all merge commits.
- CODEOWNERS must approve owned areas.
- No home-grown framework replacements when mature libraries exist.
