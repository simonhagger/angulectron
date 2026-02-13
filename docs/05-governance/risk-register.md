# Risk Register

Owner: Platform Engineering + Security  
Review cadence: Weekly  
Last reviewed: 2026-02-13

| ID    | Risk                                         | Impact | Mitigation                                      | Owner    |
| ----- | -------------------------------------------- | ------ | ----------------------------------------------- | -------- |
| R-001 | Electron security misconfiguration           | High   | Enforce preload-only bridge and secure defaults | Platform |
| R-002 | UI inconsistency across libraries            | Medium | Material-first governance and adapter policy    | UI       |
| R-003 | Contract drift between preload/main/renderer | High   | Shared schema package + CI contract tests       | Platform |
| R-004 | Dependency churn                             | Medium | Renovate with controlled auto-merge rules       | DevEx    |
| R-005 | Accessibility regressions                    | High   | Dedicated axe-based CI gate                     | Frontend |
