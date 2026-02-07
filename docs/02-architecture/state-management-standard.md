# State Management Standard

## Default Pattern

- Signals + feature-scoped services.
- `computed()` for derived state only.
- State transitions are pure and explicit.

## Scope Rules

- Component-local state remains in component signals.
- Feature state lives in feature services.
- Cross-feature state requires a platform/domain service contract.

## Side Effects

- UI side effects occur in handlers/effects, not templates.
- Async boundaries return typed results.

## Prohibited Patterns

- Mutable shared singletons for feature state.
- Hidden side effects in getters.
- `any`-typed state containers.
