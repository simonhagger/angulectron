# UI System Governance

## Primary Stack

- Angular Material is the default component system.
- Tailwind is for layout/utilities.

## Controlled Secondary Stack

- Carbon usage is allowed only through `libs/ui/carbon-adapters`.
- Carbon components are not consumed directly inside feature code.

## shadcn Pattern Policy

- Use shadcn patterns for composition ideas only.
- Implement shared primitives in `libs/ui/primitives`.

## Theming Rules

- Use design tokens and CSS variables.
- Avoid one-off component-level color systems.

## Exception Process

- Any new UI library requires ADR approval and migration impact analysis.
