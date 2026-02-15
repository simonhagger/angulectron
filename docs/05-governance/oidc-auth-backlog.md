# OIDC Authentication Backlog (Desktop)

Owner: Platform Engineering + Security  
Review cadence: Weekly  
Last reviewed: 2026-02-14  
Source: Task inbox (local, untracked)

## Objective

Implement OpenID Connect authentication for the Electron desktop app using Authorization Code + PKCE, with secure token handling in main process and a minimized renderer API surface.

## Scope

In scope:

- Desktop-side OIDC flow, token lifecycle, secure storage, and IPC/preload contracts.
- Renderer session summary and entitlement-aware UX.
- Config-driven IdP swap support (Clerk now, Cognito-ready).

Out of scope in this repo:

- Backend JWT verification implementation details (tracked in backend repo/workstream).

## Architecture Constraints

- Refresh tokens must never be exposed to renderer.
- PKCE and token exchange run in main process only.
- Renderer receives session summary and entitlement view, not raw secrets.
- Access tokens are attached in main-process API proxy by default.

## Phased Plan

## Phase 0: Design Decisions and Threat Model

Status: Planned  
Priority: High

Tasks:

- Confirm redirect strategy (`loopback` preferred, `custom protocol` fallback).
- Define auth state machine (signed-out, signing-in, active, refresh-failed, signed-out-expired).
- Document token data classification and retention periods.
- Record ADR for OIDC integration boundaries and IdP abstraction.

Acceptance tests:

- ADR merged and linked from decision log.
- Threat model delta documented for auth/refresh/IPC abuse cases.
- Security sign-off recorded in PR checklist.

## Phase 1: Contracts and IPC Surface

Status: Planned  
Priority: High

Tasks:

- Add `auth` request/response contracts in `libs/shared/contracts`.
- Add IPC channels for:
  - `auth.signIn`
  - `auth.signOut`
  - `auth.getSessionSummary`
- Add preload bridge methods under `desktop.auth.*` with strict schema validation.

Acceptance tests:

- Contract unit tests pass for valid/invalid payloads.
- Main rejects unauthorized sender and malformed auth envelopes.
- Preload rejects schema-invalid payloads/responses.

### Phase 1 PR-Sized Execution Plan

| Ticket ID | Scope                                                                                                                                                       | Depends On         | Validation                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------- |
| OIDC-001  | Add `auth.contract.ts` schemas and export wiring in `libs/shared/contracts` (requests, responses, session summary)                                          | None               | `pnpm nx test shared-contracts` and `pnpm nx lint shared-contracts` |
| OIDC-002  | Add IPC channel constants and main handler stubs (`authSignIn`, `authSignOut`, `authGetSessionSummary`) returning deterministic `NOT_IMPLEMENTED` envelopes | OIDC-001           | `pnpm nx test desktop-main` and `pnpm nx lint desktop-main`         |
| OIDC-003  | Add preload bridge API `desktop.auth.*` with Zod validation and typed invoke wrappers                                                                       | OIDC-001, OIDC-002 | `pnpm nx test desktop-preload` and `pnpm nx lint desktop-preload`   |
| OIDC-004  | Add renderer-side typed auth facade service (no UI yet), consuming only `desktop.auth.*`                                                                    | OIDC-003           | `pnpm nx test renderer` and `pnpm nx lint renderer`                 |
| OIDC-005  | Add integration tests for unauthorized sender rejection and schema-invalid payload rejection across preload/main boundary                                   | OIDC-002, OIDC-003 | `pnpm nx run-many -t test --projects=desktop-main,desktop-preload`  |
| OIDC-006  | Add temporary diagnostics page route for manual auth stub verification (calls sign in/out/get summary and surfaces envelopes)                               | OIDC-004           | `pnpm nx run renderer:build` and desktop smoke launch               |

Merge order:

1. OIDC-001
2. OIDC-002
3. OIDC-003
4. OIDC-004
5. OIDC-005
6. OIDC-006

Definition of done for Phase 1:

- All six tickets merged through PR workflow.
- `pnpm ci:local` passes with no new warnings.
- No raw token fields present in preload/renderer models.
- Security checklist included in each PR body.

## Phase 2: OIDC Discovery + PKCE Sign-In

Status: Planned  
Priority: High

Tasks:

- Implement OIDC discovery (`.well-known/openid-configuration`).
- Implement PKCE verifier/challenge generation and in-memory verifier tracking.
- Launch system browser for authorization URL.
- Handle callback and code exchange in main process.

Acceptance tests:

- Discovery fails safely with deterministic error envelope.
- PKCE values meet RFC constraints (length/entropy/challenge method S256).
- End-to-end sign-in returns active session summary without exposing tokens to renderer.

## Phase 3: Token Lifecycle + Secure Storage

Status: Planned  
Priority: High

Tasks:

- Persist refresh token in OS secure storage abstraction (Windows Credential Manager implementation first).
- Keep access token in memory with expiry metadata.
- Implement proactive refresh and refresh-failure fallback to signed-out state.
- Implement sign-out revocation/cleanup behavior where IdP supports it.

Acceptance tests:

- Refresh token not found in renderer memory snapshots or logs.
- Refresh runs before expiry and updates session summary.
- Expired/invalid refresh token transitions to signed-out and clears storage.

## Phase 4: API Authorization Path

Status: Planned  
Priority: High

Tasks:

- Extend main-process API gateway to attach `Authorization: Bearer <access_token>` for secured operations.
- Classify auth failures (`401/403`) and map to app-level failure policies.
- Keep renderer direct-token access disabled by default.

Acceptance tests:

- Secured operation includes bearer token only when session is active.
- Missing/expired token returns auth classification, not generic failure.
- No token value appears in telemetry/event logs.

## Phase 5: Renderer Session UX

Status: Planned  
Priority: Medium

Tasks:

- Add session store in renderer (signals-based).
- Implement sign-in/sign-out controls and session status display.
- Apply entitlement/claim-driven soft gating in UI.
- Add user-safe failure messages for auth/network/timeout paths.

Acceptance tests:

- Renderer can render signed-in summary (name/email/expiry) from preload only.
- UI gates respond to entitlement model without trusting client for enforcement.
- Auth failure states are recoverable and non-blocking for app shell.

## Phase 6: Config-Driven IdP Swap

Status: Planned  
Priority: Medium

Tasks:

- Add centralized auth settings and import/export support:
  - `issuer`
  - `clientId`
  - `redirectUri`
  - `scopes`
  - `audience`
  - optional `sendAudienceInAuthorize`, `apiBearerTokenSource`, `allowedSignOutOrigins`
- Validate config on startup with explicit failure classification.
- Document Clerk baseline and Cognito migration mapping.

Acceptance tests:

- App fails fast with actionable diagnostics for invalid/missing OIDC config.
- Same code path works with two runtime settings fixtures (Clerk-like and Cognito-like metadata).
- No code changes required to switch provider in local environment.

## Phase 7: Test + CI Hardening

Status: Planned  
Priority: High

Tasks:

- Add unit tests for OIDC service, token lifecycle, and storage adapter.
- Add integration tests for preload/main auth IPC handlers.
- Add runtime smoke route checks for sign-in UI boot path (without live IdP secrets in CI).

Acceptance tests:

- `pnpm ci:local` remains green with new auth tests enabled.
- CI gate includes auth contract and IPC integration tests.
- Production package smoke run has no renderer console warnings/errors on auth routes.

## Exit Criteria

- OIDC sign-in and sign-out are functional in packaged desktop build.
- Refresh token never crosses preload boundary.
- Main-process proxy path successfully authorizes protected API operations.
- Auth integration is provider-configurable and migration-ready.
- Security checklist and threat assessment updates are complete for merge.

## Current Constraint (Clerk OAuth)

- Clerk OAuth access tokens in the current tenant flow do not emit API `aud` claims required by the AWS JWT authorizer (`YOUR_API_AUDIENCE`), even with JWT access tokens enabled.
- Temporary compatibility control is active in AWS authorizer audience list:
  - `YOUR_API_AUDIENCE`
  - OAuth client id (`YOUR_OAUTH_CLIENT_ID`)
- Temporary control risk: broader acceptance than strict API-audience-only validation.
- Removal condition:
  - Clerk issues access tokens with `aud` including `YOUR_API_AUDIENCE` (and required scopes when available).
  - AWS authorizer audience list is reduced to API audience only.
  - Desktop flow validation passes with `apiBearerTokenSource=access_token`.
