# Electron + Angular (Nx Workspace) Security Threat Assessment Checklist & Hardening Guide

**Purpose:** This document is a prescriptive, agent-friendly checklist to (1) threat model an Electron app with an Angular renderer in an Nx workspace, (2) self-assess the current security posture, and (3) implement hardening improvements.

**Scope:** Electron **main process**, **preload bridge**, **renderer (Angular v21)**, packaging/distribution, update mechanism, and OS integrations.

**Assumptions:**

- Angular runs in Electron renderer(s).
- Main process is trusted; renderer is treated as untrusted.
- IPC boundary is the primary trust boundary.
- Nx workspace contains apps/libs; Electron main/preload likely live in a dedicated app (e.g., `apps/desktop`) and Angular UI in another (e.g., `apps/ui`).

---

## 0) Threat Model Baseline (Do This First)

### 0.1 Trust Boundaries

- **Main process (trusted):** full Node + OS capabilities.
- **Preload (high trust, minimal):** exposes a controlled API surface.
- **Renderer (untrusted):** assume XSS is possible.

### 0.2 Primary Threats (Ranked)

1. **Renderer compromise → privilege escalation** via Node integration, unsafe preload API, or permissive IPC.
2. **Arbitrary file/system access** via IPC endpoints (path traversal, shell injection, overly generic endpoints).
3. **Remote content / navigation attacks** (loading attacker-controlled URLs, `window.open`, redirects).
4. **Supply chain compromise** (npm deps, build pipeline, auto-update feed).
5. **Secrets leakage** (tokens in renderer/localStorage, logs, crash dumps).
6. **Unsafe updates** (no signing / insecure transport / downgrade attacks).

### 0.3 Security Objective

- Renderer may be compromised without granting attacker OS-level capabilities.
- Preload API is capability-based and minimal.
- IPC is validated, authorized, and least-privileged.

---

## 1) Inventory & Architecture Map (Agent Must Produce)

### 1.1 Identify files and entry points

**Action:** Locate and list:

- Electron main entry file (e.g., `main.ts`, `electron-main.ts`).
- Preload script entry file (e.g., `preload.ts`).
- BrowserWindow creation code.
- Any `ipcMain.handle/on` registrations.
- Any `ipcRenderer.invoke/send` usage.
- Any usage of `shell.openExternal`, `webContents`, `session`, `protocol`, `webview`, `remote`.

**Output required:** A short architecture map with:

- Window names and what they load (`http://localhost:*` or `file://...`).
- IPC channel list.
- Preload exposed API shape.

### 1.2 Classify data flows

**Action:** For each IPC endpoint, record:

- Inputs (types, sources)
- Privileged operations performed (FS, network, OS, exec)
- Outputs returned

**Output required:** A table-like list in plain text (safe for agents) with per-endpoint summary.

---

## 2) BrowserWindow & Renderer Hardening (Highest Priority)

### 2.1 Mandatory BrowserWindow webPreferences

**Agent must enforce** the following in all window creation paths unless a documented exception exists:

- `contextIsolation: true` ✅ REQUIRED
- `nodeIntegration: false` ✅ REQUIRED
- `sandbox: true` ✅ STRONGLY RECOMMENDED (verify compatibility)
- `enableRemoteModule: false` ✅ REQUIRED (remote is legacy; avoid)
- `webSecurity: true` ✅ REQUIRED
- `allowRunningInsecureContent: false` ✅ REQUIRED
- `experimentalFeatures: false` ✅ RECOMMENDED

**Implementation pattern (main process):**

- Centralize `createWindow()` with one canonical set of preferences.
- Disallow ad-hoc BrowserWindow creation.

**Self-check:**

- Search for `new BrowserWindow(` and verify all flags.
- Ensure no window sets `nodeIntegration: true` or `contextIsolation: false`.

### 2.2 Disable/Constrain new windows and navigation

**Agent must implement:**

- `webContents.setWindowOpenHandler(() => ({ action: 'deny' }))` by default.
- Intercept `will-navigate` to block navigation to non-app origins.
- Route external links to OS browser using `shell.openExternal` ONLY after URL validation.

**URL validation policy (required):**

- Allowlist schemes: `https:` (and maybe `mailto:`) only.
- Deny: `javascript:`, `data:`, `file:`, `vbscript:`.
- Allowlist hostnames if applicable.

### 2.3 Avoid `webview`

- If `webview` is used, treat it as a high-risk surface. Prefer not to.
- If unavoidable, isolate to a dedicated window/session with strict policies.

### 2.4 Content Security Policy (CSP)

**Agent must ensure** CSP is present for production renderer content.

**Preferred CSP (starting point; adjust for Angular build needs):**

- Default: `default-src 'self'`
- Scripts: `script-src 'self'` (avoid `'unsafe-inline'` and `'unsafe-eval'`)
- Styles: `style-src 'self' 'unsafe-inline'` (Angular may require inline styles; minimize)
- Images: `img-src 'self' data:`
- Connect: `connect-src 'self' https:` (tighten to known endpoints)
- Frames: `frame-src 'none'`
- Base URI: `base-uri 'self'`
- Object: `object-src 'none'`

**Self-check:**

- Verify CSP in `index.html` or headers (for `file://` consider meta tag).
- Ensure no reliance on eval-based tooling in production.

---

## 3) Preload Bridge Hardening (Second Highest Priority)

### 3.1 Design rules (must follow)

- Use `contextBridge.exposeInMainWorld` to expose a single namespace (e.g., `window.api`).
- Expose **capabilities**, not raw Electron/Node objects.
- No generic “execute” endpoints.
- No direct access to `ipcRenderer` in renderer.
- All inputs validated in preload and again in main.

### 3.2 API surface constraints

**Agent must enforce:**

- Only explicit, named methods.
- No dynamic channel construction.
- No pass-through of user-provided channel names.
- Events: provide subscribe/unsubscribe wrappers; never expose unrestricted event buses.

### 3.3 Allowed IPC channel list

**Agent must implement:**

- An allowlist array/enum of channel names in preload.
- Wrapper functions only call `ipcRenderer.invoke` / `ipcRenderer.on` for allowlisted channels.

### 3.4 Serialization constraints

- Only allow structured-clone safe data: JSON-like primitives, arrays, plain objects.
- Avoid passing functions, class instances, Buffers (unless explicitly handled).

---

## 4) IPC Security: Validation, Authorization, Least Privilege (Critical)

### 4.1 Use invoke/handle by default

**Policy:** Prefer `ipcMain.handle` + `ipcRenderer.invoke` for request/response.

- Use `send/on` only for narrow event cases.

### 4.2 Input validation (required)

**Agent must implement:**

- Schema validation for every IPC handler.
- Reject unknown fields.
- Normalize and validate paths.

**Recommended approach:** Use a schema library (e.g., zod) in main.

### 4.3 Authorization / window identity (required)

**Agent must implement** per handler:

- Identify caller window (`event.senderFrame`, `event.sender`) and check it belongs to expected origin/window type.
- Optional: capability tokens per window instance if multiple privilege tiers exist.

### 4.4 Filesystem access policy

**Hard requirement:** Renderer must not be able to request arbitrary path reads/writes.

**Agent must implement:**

- Prefer dialogs initiated by main (`showOpenDialog`, `showSaveDialog`) over accepting paths.
- If paths are accepted, enforce:
  - `path.resolve` normalization
  - allowlist root directories (e.g., app-specific data dir)
  - deny traversal (`..`) and symlinks if needed

### 4.5 Process execution policy

**Hard requirement:** Avoid `child_process.exec` with string concatenation.

**Agent must implement:**

- Use `spawn` with explicit argument arrays.
- Allowlist executables and arguments.
- Validate inputs strictly.

### 4.6 Return data minimization

- Return only what renderer needs.
- Avoid returning secrets or full file contents unless essential.

---

## 5) Remote Content, Networking, and Sessions

### 5.1 Remote content policy

- Prefer loading local `file://` assets for app UI.
- If remote content is necessary:
  - isolate to separate `BrowserWindow`/`session`
  - strong CSP
  - disable Node integration (still)
  - strict navigation allowlist

### 5.2 Session hardening

**Agent should check** for:

- custom protocols
- persistent partitions
- permission handlers

**Required:** implement `session.setPermissionRequestHandler` to deny by default and allowlist specific permissions.

### 5.3 Certificate / TLS considerations

- Do not disable certificate verification.
- Avoid `app.commandLine.appendSwitch('ignore-certificate-errors')`.

---

## 6) Secrets, Credentials, and Sensitive Data

### 6.1 Secret storage

**Policy:** secrets belong in main, stored using OS credential store if possible.

**Agent must enforce:**

- No tokens in renderer localStorage/sessionStorage.
- No secrets embedded in preload-exposed APIs.

### 6.2 Logging

**Agent must enforce:**

- No secrets in logs.
- Sanitize IPC inputs before logging.
- Control log level in production.

### 6.3 Crash dumps

- Review crash reporting settings and ensure sensitive data is not included.

---

## 7) Angular Renderer Security (XSS & DOM Safety)

### 7.1 XSS prevention

**Agent must audit:**

- Any use of `[innerHTML]`, `DomSanitizer.bypassSecurityTrust*`.
- Markdown/HTML rendering libraries.
- Dynamic URL bindings.

**Policy:**

- Avoid bypass APIs; if used, document and constrain inputs.
- Sanitize untrusted HTML with a well-reviewed sanitizer.

### 7.2 CSP alignment

- Ensure Angular build does not require `unsafe-eval` in production.
- Avoid runtime template compilation.

### 7.3 Dependency hygiene

- Audit third-party UI components that manipulate DOM.

---

## 8) Packaging, Updates, and Distribution

### 8.1 Auto-update security (if used)

**Agent must verify:**

- Updates are delivered over HTTPS.
- Update artifacts are signed.
- No downgrade attacks (version pinning / checks).

### 8.2 Code signing

- Ensure builds are signed for target OS (Windows/macOS) as appropriate.

### 8.3 ASAR and integrity

- ASAR is not a security boundary, but reduces casual tampering.
- Consider integrity checks if threat model requires.

---

## 9) Supply Chain & Build Pipeline (Nx)

### 9.1 Dependency audit

**Agent must do:**

- Identify Electron-related deps (`electron`, `electron-builder`, `@electron/*`, etc.).
- Run dependency vulnerability scanning (tooling choice depends on environment).
- Pin versions for critical packages.

### 9.2 Nx boundaries

**Agent should enforce:**

- Main/preload code in dedicated libs with strict lint rules.
- Renderer cannot import Node-only libs.
- Use Nx tagging + module boundary rules to prevent accidental cross-layer imports.

### 9.3 Build separation

- Separate build targets for main, preload, renderer.
- Ensure preload is bundled appropriately and not accidentally exposed as editable runtime script.

---

## 10) Concrete Self-Assessment Checklist (Agent Must Output as PASS/FAIL)

**Agent must produce a report** with each item marked PASS/FAIL and evidence (file path + snippet reference). Do not skip items.

### A) Window Hardening

- [ ] All BrowserWindow instances use `contextIsolation: true`.
- [ ] All BrowserWindow instances use `nodeIntegration: false`.
- [ ] `sandbox: true` is enabled (or exception documented).
- [ ] `enableRemoteModule` is false and remote is not used.
- [ ] `setWindowOpenHandler` denies by default.
- [ ] `will-navigate` prevents navigation to non-app origins.
- [ ] External link handling validates URL schemes.

### B) Preload

- [ ] Renderer does not import/use `ipcRenderer` directly.
- [ ] `contextBridge.exposeInMainWorld` exposes a minimal API.
- [ ] IPC channels are allowlisted.
- [ ] Preload does not expose raw Electron objects.

### C) IPC Handlers (Main)

- [ ] Every `ipcMain.handle/on` validates input schema.
- [ ] Every handler enforces caller authorization / expected origin.
- [ ] No handler provides arbitrary FS read/write.
- [ ] No handler runs shell commands with unvalidated user input.

### D) Navigation/Remote Content

- [ ] App UI loads only from expected origins (`file://` or dev localhost).
- [ ] Remote content (if any) is isolated and tightly allowlisted.
- [ ] Permissions are denied by default via session permission handler.

### E) CSP

- [ ] Production renderer has CSP.
- [ ] CSP avoids `unsafe-eval`.
- [ ] CSP avoids `unsafe-inline` for scripts.

### F) Secrets

- [ ] No secrets stored in renderer storage.
- [ ] Secrets stored in main using OS store (or documented alternative).
- [ ] Logs scrub secrets.

### G) Angular/XSS

- [ ] No unsafe `innerHTML` usage without sanitization.
- [ ] `bypassSecurityTrust*` is not used, or each use is documented and constrained.

### H) Updates/Signing

- [ ] Update channel is HTTPS and artifacts are signed.
- [ ] Code signing configured for release builds.

### I) Supply Chain

- [ ] Dependency scanning performed and critical findings addressed.
- [ ] Nx module boundaries prevent renderer importing main/preload internals.

---

## 11) Prescriptive Remediation Playbook (Apply In This Order)

### Step 1: Lock down BrowserWindow defaults

- Create a single `createMainWindow()` function.
- Apply mandatory webPreferences.
- Remove/replace any divergent window configs.

### Step 2: Implement navigation controls

- Add `setWindowOpenHandler` deny-by-default.
- Add `will-navigate` guard.
- Add safe external link opener with URL validation.

### Step 3: Replace ad-hoc IPC with a typed capability API

- Define a `channels.ts` enum/const list shared by preload+main.
- Preload exposes `window.api` with narrow functions.
- Main implements `ipcMain.handle` per capability.

### Step 4: Add schema validation for every IPC handler

- Introduce schemas in main.
- Reject unknown keys.
- Normalize paths and enforce allowlists.

### Step 5: Remove dangerous primitives

- Eliminate any `remote` usage.
- Eliminate `nodeIntegration: true`.
- Replace `exec` with allowlisted `spawn` patterns.

### Step 6: CSP + Angular alignment

- Add CSP to production `index.html`.
- Ensure Angular build does not require eval in prod.
- Fix any violations by adjusting build config or libraries.

### Step 7: Secrets hygiene

- Move secrets from renderer to main.
- Implement OS credential store usage.
- Ensure logs and crash reporting avoid sensitive data.

### Step 8: Updates and signing

- Verify HTTPS update feeds.
- Ensure signing configured.
- Add downgrade protections.

### Step 9: Nx enforcement

- Add Nx tags and enforce module boundaries.
- Ensure renderer cannot import main/preload libs.

---

## 12) Agent Output Requirements

When run against the repository, the agent must output:

1. **Architecture map** (windows, origins, preload API, IPC channels).
2. **PASS/FAIL checklist** with evidence pointers.
3. **Patch plan**: ordered list of changes, each referencing files and rationale.
4. **Implemented changes** (if allowed) with verification notes.

---

## Appendix: “Good Defaults” Reference (Copy Into Code)

### BrowserWindow baseline (conceptual)

- Context isolation ON
- Node integration OFF
- Sandbox ON (if compatible)
- Web security ON
- No remote
- Strict navigation control

### IPC baseline

- invoke/handle
- channel allowlist
- schema validation
- caller authorization
- least privilege
