# Implementation requirements for local agent

These requirements translate the earlier feedback into concrete, implementable work items. They are structured as **MUST / SHOULD / MAY** and include **acceptance criteria**.

---

## R-01 Performance standards and budgets

### R-01.1 Define performance budgets (MUST)

**Requirement:** Create a `Performance Standards` document that defines measurable budgets for the desktop app.

**Acceptance criteria:**

- Document includes **at minimum**:
  - **Cold start time** budget (app launch → first interactive)
  - **Warm start** budget
  - **Renderer responsiveness** budget (e.g., main thread long tasks / input delay)
  - **Memory footprint** targets (idle and typical workload)
  - **CPU usage** targets (idle and typical workload)

- Budgets are expressed in explicit units (ms, MB, % CPU) and include **measurement method** for each.

### R-01.2 Add automated performance checks (SHOULD)

**Requirement:** Add CI checks to prevent regressions against the defined budgets.

**Acceptance criteria:**

- CI job runs a repeatable performance test suite (headless where possible).
- Output is stored as artifacts and compared to baseline.
- Failing thresholds are defined and enforced (e.g., >10% regression fails).

### R-01.3 Add local profiling scripts (MAY)

**Requirement:** Provide developer scripts for profiling start-up, memory, and IPC latency.

**Acceptance criteria:**

- `npm`/`pnpm` scripts exist (e.g., `perf:start`, `perf:ipc`, `perf:memory`).
- Scripts generate machine-readable outputs (JSON) + human summary.

---

## R-02 Observability and diagnostics

### R-02.1 Define telemetry/logging strategy (MUST)

**Requirement:** Create an `Observability & Diagnostics` document specifying logging, metrics, and crash reporting expectations.

**Acceptance criteria:**

- Document specifies:
  - Log levels, structure (JSON), and required fields (timestamp, correlation id, component, version)
  - Where logs are written and retention policy
  - Crash reporting approach (what is collected, what is excluded)
  - User privacy constraints

- Defines correlation across boundaries (renderer ↔ preload ↔ main via correlation IDs).

### R-02.2 Implement structured logging with correlation IDs (SHOULD)

**Requirement:** Introduce a shared logging utility usable from main, preload, and renderer.

**Acceptance criteria:**

- All IPC requests include a `correlationId`.
- Logs in main/preload/renderer include that `correlationId`.
- Minimal example included in docs.

---

## R-03 Reliability and error handling

### R-03.1 Standardize error taxonomy (MUST)

**Requirement:** Define a consistent error model for IPC and app services.

**Acceptance criteria:**

- A documented error envelope exists (e.g., `{ code, message, details, retryable, cause, correlationId }`).
- Error `code` values are namespaced (e.g., `IPC/VALIDATION_FAILED`, `FS/NOT_FOUND`).
- Rules for user-facing vs internal messages are documented.

### R-03.2 Define retry and timeout policies (MUST)

**Requirement:** Document when to retry, when to fail fast, and how timeouts are applied.

**Acceptance criteria:**

- IPC calls define default timeout values.
- Retry strategy specified (max attempts, backoff, jitter) and where it is allowed.
- Explicit list of operations that must **never** be retried (e.g., non-idempotent).

### R-03.3 Define UX patterns for failures (SHOULD)

**Requirement:** Provide UI/UX guidance for presenting failures.

**Acceptance criteria:**

- Patterns exist for:
  - transient failure toast
  - blocking error dialog
  - inline field errors
  - offline mode banner (if applicable)

- Each pattern specifies what information is shown to the user.

### R-03.4 Crash recovery guidance (MAY)

**Requirement:** Document restart behavior and safe-state recovery.

**Acceptance criteria:**

- Defines what state is persisted and how corruption is handled.
- Defines whether renderer crashes trigger auto-reload and under what conditions.

---

## R-04 IPC contract testing and ownership

### R-04.1 Prescribe testing scope by layer (MUST)

**Requirement:** Add a `Testing Scope & Ownership` section to the testing strategy.

**Acceptance criteria:**

- For each layer (unit/integration/E2E/contract), document:
  - what belongs there
  - what must not be tested there
  - mocking guidance

- Defines ownership:
  - platform-owned contract harness
  - feature-owned contract tests for their channels

### R-04.2 Implement contract tests against real handlers (SHOULD)

**Requirement:** Ensure IPC channels have contract tests that execute real preload/main handlers.

**Acceptance criteria:**

- Contract tests validate:
  - schema validation behavior
  - error envelope behavior
  - timeout behavior
  - correlation ID propagation

- Tests run in CI and are required for any new privileged IPC channel.

---

## R-05 Security review cadence and threat modeling triggers

### R-05.1 Define lightweight security review workflow (MUST)

**Requirement:** Add a `Security Review` section describing when and how security review occurs.

**Acceptance criteria:**

- Defines triggers:
  - new privileged IPC channel
  - new native module
  - new file system access path
  - changes to `webPreferences` / sandboxing / CSP

- Defines minimum review artifacts:
  - updated IPC contract
  - mini threat model (assets, trust boundaries, misuse cases)
  - verification checklist

### R-05.2 Add a security checklist gate (SHOULD)

**Requirement:** Require a checklist completion for PRs affecting security-sensitive areas.

**Acceptance criteria:**

- PR template includes a security section.
- CI ensures the checklist is not removed/empty when labels/tags indicate sensitivity.

---

## R-06 Boundary rules clarity and onboarding ergonomics

### R-06.1 Add forbidden-dependencies table (MUST)

**Requirement:** Add a concise matrix/table of forbidden dependencies by tag.

**Acceptance criteria:**

- Document includes:
  - examples of allowed vs forbidden imports
  - rationale for top 3 forbidden cases

- Nx/ESLint rules are referenced and aligned with the table.

### R-06.2 Add a one-page onboarding quickstart (SHOULD)

**Requirement:** Provide an `Engineering Quickstart` document for new contributors.

**Acceptance criteria:**

- Includes:
  - repo structure map
  - how to create a feature lib
  - how to add an IPC endpoint safely
  - how to run key CI checks locally
  - definition of done summary

---

## R-07 Documentation integration and traceability

### R-07.1 Cross-link standards (MUST)

**Requirement:** Ensure the new docs integrate with existing ADR/DoD/security/testing docs.

**Acceptance criteria:**

- Each new document links to:
  - relevant ADRs
  - definition of done updates
  - relevant CI checks

- A `Docs Index` page lists all standards with owners.

### R-07.2 Add doc ownership metadata (SHOULD)

**Requirement:** Add an owner and review frequency to each standards document.

**Acceptance criteria:**

- Each doc includes:
  - Owner/team
  - Review cadence (e.g., quarterly)
  - Last reviewed date

---

## Implementation order (recommended)

1. R-01.1 Performance budgets
2. R-02.1 Observability & diagnostics
3. R-03.1 + R-03.2 Error model + retry/timeouts
4. R-04.1 Testing scope/ownership
5. R-05.1 Security review cadence
6. R-06.1 Forbidden deps matrix
7. Automation and CI gates (R-01.2, R-02.2, R-04.2, R-05.2)

---

## Definition of Done updates (apply to all)

- Any new privileged IPC channel includes: contract + contract test + threat review artifact.
- Any new platform capability includes: observability hooks + documented performance impact.
- Any new UI feature includes: a11y checks and i18n compliance per existing standards.
