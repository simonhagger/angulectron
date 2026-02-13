# Testing Strategy

Owner: QA + Platform Engineering  
Review cadence: Quarterly  
Last reviewed: 2026-02-07

## Pyramid

- Unit tests (Vitest): business logic and isolated component behavior.
- Integration tests (Vitest): IPC contract and service orchestration.
- E2E tests (Playwright): critical user journeys.

## Coverage

- Global minimum threshold: 80%.
- Contract and security-critical paths should exceed baseline.
- Python sidecar runtime tests enforce a stricter threshold (90%) because they guard privileged parser ingress.

## A11y

- Dedicated `@a11y` E2E scenarios with axe checks.

## Test Ownership

- Library owners maintain tests in their package.
- Contract owners maintain schema and handler tests.

## Testing Scope And Ownership

### Unit

- Belongs: deterministic business rules, pure transformations, validation helpers.
- Does not belong: multi-process Electron plumbing.
- Mocking guidance: mock IO boundaries; avoid mocking internal pure functions.

### Integration

- Belongs: preload->main handler behavior, contract validation, error envelope mapping.
- Does not belong: full UI journey assertions.
- Mocking guidance: real schemas + real handler code; mock only external systems.

### Contract

- Belongs: request/response schema compatibility and failure shape enforcement.
- Does not belong: rendering concerns.
- Ownership:
  - Platform owns shared harness and global channel conventions.
  - Feature teams own contract tests for channels they introduce.

### Runtime Helper (Python)

- Belongs: local helper endpoint behavior, negative-path validation, safe response envelope shape.
- Does not belong: renderer UI behavior (covered by UI/e2e tests).
- Ownership:
  - Platform owns helper harness and coverage gates.
  - Feature teams own behavior-specific helper tests for introduced operations.

### E2E

- Belongs: user-visible flows and critical platform interactions.
- Does not belong: exhaustive permutation or unit-level edge coverage.
- Mocking guidance: minimal; prefer realistic environment.

## CI Policy

- Failing test gates block merge.
- `desktop-main:test` includes both TypeScript tests and Python sidecar tests (`test-ts` + `test-python`).
