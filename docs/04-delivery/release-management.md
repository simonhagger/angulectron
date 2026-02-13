# Release Management

Owner: Release Engineering  
Review cadence: Quarterly  
Last reviewed: 2026-02-13

## Versioning

- Conventional Commits + Changesets.
- SemVer enforced through release automation.

## Channels

- `dev`: continuous internal validation.
- `beta`: staged pre-production validation.
- `stable`: production channel.

## Promotion Model

1. Build and verify in `dev`.
2. Promote validated commit to `beta`.
3. Promote approved `beta` candidate to `stable`.

## Rollback

- Maintain last-known-good stable package metadata.
- Re-point update feed to previous stable artifact on rollback.
