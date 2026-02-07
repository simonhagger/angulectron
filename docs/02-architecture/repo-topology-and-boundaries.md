# Repo Topology And Boundaries

Owner: Platform Engineering  
Review cadence: Quarterly  
Last reviewed: 2026-02-07

## Workspace Layout

- `apps/*` for runnable applications.
- `libs/*` for reusable units.
- `docs/*` for governance artifacts.

## Enforced Tags

- Types: `type:app`, `type:feature`, `type:ui`, `type:platform`, `type:contracts`, `type:data-access`, `type:domain`, `type:util`
- Platforms: `platform:renderer`, `platform:main`, `platform:preload`, `platform:shared`

## Boundary Rules

- Apps depend on libs only.
- Renderer code depends only on `platform:renderer` and `platform:shared` libs.
- Main/preload code depends only on `platform:main|preload|shared` libs.
- UI libs cannot depend on app or feature libs.
- Domain libs cannot depend on data-access libs.

## Anti-Corruption Rule

OS or Electron-specific concerns must terminate in `libs/platform/*` or `apps/desktop-*`, never inside domain or UI libraries.

## Forbidden Dependencies Matrix

| From                | Forbidden                                   | Why                                          |
| ------------------- | ------------------------------------------- | -------------------------------------------- |
| `platform:renderer` | `platform:main`, Node/Electron process APIs | Prevent renderer privilege escalation.       |
| `type:ui`           | `type:app`, `type:feature`                  | Keep UI reusable and avoid feature coupling. |
| `type:domain`       | `type:data-access`                          | Preserve domain purity and testability.      |

Allowed examples:

- `apps/renderer` -> `libs/platform/desktop-api`
- `apps/desktop-main` -> `libs/shared/contracts`
- `libs/feature/*` -> `libs/domain/*`, `libs/ui/*`

Forbidden examples:

- Renderer component importing `electron` or `node:fs`
- Domain library importing repository implementation directly
- UI primitive importing feature-specific state
