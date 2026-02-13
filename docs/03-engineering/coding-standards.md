# Coding Standards

Owner: Platform Engineering  
Review cadence: Quarterly  
Last reviewed: 2026-02-13

## Angular

- Standalone components only.
- `ChangeDetectionStrategy.OnPush` default.
- `input()` and `output()` over decorators.
- Native control flow (`@if`, `@for`, `@switch`).

## TypeScript

- Strict mode and no `any`.
- Prefer inferred types when obvious.
- Export explicit public interfaces from each library.

## Architecture

- Keep functions atomic and single-purpose.
- Extract reusable logic into libraries.
- Avoid cyclic dependencies.

## Templates

- Keep logic minimal.
- No regex or lambda expressions in templates.

## Styling

- Tailwind for layout/util classes.
- Component CSS for local behavior only.
