<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->

<!-- agent knowledgebase start -->

# CONTEXT

Operational context and working conventions for this repository.

## Project Intent

- Build quality over speed. Prefer robust, maintainable implementation over quick patches.
- Keep OIDC/IdP integration provider-agnostic. Clerk is an example configuration, not a product dependency.

## Non-Negotiables

- Frontend work should prioritize strict Angular v21 features/syntax.
- Use Nx commands for repo tasks (`pnpm nx ...`) instead of underlying tools directly.
- Preserve privileged-boundary security posture between renderer, preload, and desktop-main.

## Git / PR Discipline

- Use conventional commit messages.
- Keep commits logically grouped and reviewable.
- Never push to GitHub, open PRs, or merge PRs without explicit user approval in the current session.
- Default mode is local-only work (local edits, local commits, local validation) until push is explicitly approved.
- Before every commit, run a secret/sensitive-data sweep on staged and recent changed files (examples: `git diff --cached`, targeted `rg` for tenant IDs/domains/client IDs/tokens/keys) and sanitize to placeholders for tracked examples/docs/tests.
- Before any approved push, present branch, commit list, validation results, and proposed PR scope.
- Use the full PR template and complete checklist sections.
- For security-sensitive changes, PR body must include exact checked lines:
  - `- [x] Security review completed`
  - `- [x] Threat model updated or N/A explained`
- Include concrete validation evidence in PR body.
- Preferred GitHub flow:
  - Run local CI-parity checks before push.
  - Push only when explicitly approved.
  - Create/update PR from `tools/templates/pr-draft.md` with checklist lines completed.
  - Monitor GitHub checks directly (`gh pr checks --watch`) and report status.
  - Merge on user approval once required checks are green.

## Validation Baseline Before PR

- `pnpm unit-test`
- `pnpm integration-test`
- `pnpm runtime:smoke`

Add targeted checks relevant to changed areas (for example: `renderer:test`, `desktop-main:test`, `renderer:build`).

## Repository-Specific Conventions

- `FR*.md` files are transient feature-request artifacts and should not be treated as long-lived docs.
- Root task/feedback handoff docs may be intentionally blank until user provides content.
- `FILE_INDEX.txt` is transient and gitignored; do not wire into repo-wide CI checks.
- Agent working context is maintained in `AGENTS.md` inside the knowledgebase markers; `CONTEXT.md` is not used.

## Architecture Direction (Current)

- Desktop main IPC handlers are modularized under `apps/desktop-main/src/ipc/`.
- Shared validated IPC handler path is the standard for authz + schema validation + envelope consistency.
- Preload bridge is modularized under `apps/desktop-preload/src/api/` with shared invoke client in `apps/desktop-preload/src/invoke-client.ts`.
- Renderer auth session is hydrated through shared state service (`apps/renderer/src/app/services/auth-session-state.service.ts`) and consumed by auth UI/guards.

## Known Good Behaviors

- Keep IdP interaction in external browser for native OIDC flow.
- Keep app UI stable during sign-in and reflect pending/cancelled states clearly.
- Ensure auth-sensitive UI controls are gated on initialized session state (avoid stale default button enablement).
- For Python sidecar packaging, treat packaged builds as deterministic runtime-only:
  - bundle interpreter + pinned dependencies into `python-runtime/<platform>-<arch>`
  - disable system Python fallback when `app.isPackaged`
  - expose interpreter path diagnostics (`pythonExecutable`) so packaged runtime use is provable.
- Before packaging, run runtime preflight checks:
  - `pnpm run python-runtime:prepare-local`
  - `pnpm run python-runtime:assert`
- For CI targeted formatting checks, use `FETCH_HEAD` as base to avoid non-fast-forward ref update failures when base branch moves during CI.

## Known Pitfalls To Avoid

- Opening PRs without fully completed checklist sections (especially security checklist lines) causes avoidable CI failures.
- Treating provider-specific behavior (for example Clerk redirect routing) as product behavior leads to incorrect refactors.
- Assuming renderer initial auth state without hydration causes misleading UI states.
- On Windows, staging app processes can lock `out/@electron-foundation-source-win32-x64` and break forge clean/package with `EBUSY`; close/kill running packaged app instances before rerunning `forge:make:*`.
- Naive string replacement of `app.asar` can corrupt already-unpacked paths (`app.asar.unpacked.unpacked`); use guarded replacement logic.

## Maintenance Rule

- Update this file as new patterns emerge:
  - Add successful implementation patterns worth repeating.
  - Add failure modes and anti-patterns observed in CI/runtime/review.
  - Keep entries short, concrete, and action-oriented.

<!-- agent knowledgebase end -->
