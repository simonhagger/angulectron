# Git And PR Policy

## Branching Model

- `main` is protected.
- Feature branches are short-lived (`feat/*`, `fix/*`, `chore/*`).
- Merge by PR only.

## Review Requirements

- Minimum 2 approvals on protected branches.
- CODEOWNERS review required for owned paths.

## Commit Requirements

- Conventional Commits required.
- Commit message validated by Husky + commitlint.

## Merge Strategy

- Squash merge to keep linear history.
- All required CI checks must pass.

## Prohibited

- Direct pushes to `main`.
- Force push on protected branches.
