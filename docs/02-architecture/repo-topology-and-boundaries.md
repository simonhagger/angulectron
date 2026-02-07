# Repo Topology And Boundaries

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
