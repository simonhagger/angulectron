# System Context

## Actors

- End user operating a Windows desktop application.
- Product engineering team building feature libraries.
- Release engineering pipeline publishing channel artifacts.

## Core Systems

- Renderer: Angular 21 UI and feature orchestration.
- Desktop host: Electron main process for OS/file/update integration.
- Preload bridge: audited API surface exposed as `window.desktop`.

## External Dependencies

- GitHub for SCM and CI/CD.
- npm ecosystem for framework/tooling libraries.
- Optional API backends (desktop-first, cloud-optional model).

## Trust Boundaries

- Renderer is untrusted input boundary.
- Preload is controlled mediation boundary.
- Main process is privileged boundary.
- File system and update channels are high-risk integration points.
