# Testing Strategy

## Pyramid

- Unit tests (Vitest): business logic and isolated component behavior.
- Integration tests (Vitest): IPC contract and service orchestration.
- E2E tests (Playwright): critical user journeys.

## Coverage

- Global minimum threshold: 80%.
- Contract and security-critical paths should exceed baseline.

## A11y

- Dedicated `@a11y` E2E scenarios with axe checks.

## Test Ownership

- Library owners maintain tests in their package.
- Contract owners maintain schema and handler tests.

## CI Policy

- Failing test gates block merge.
