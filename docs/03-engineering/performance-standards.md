# Performance Standards

Owner: Platform Engineering  
Review cadence: Quarterly  
Last reviewed: 2026-02-07

## Budgets

| Metric                                     | Budget                                           | Measurement method                                                                                 |
| ------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Cold start (launch to first interactive)   | <= 2500 ms p95                                   | Electron startup marker in main + renderer first-interactive marker in preload bridge test harness |
| Warm start (second launch in same session) | <= 1200 ms p95                                   | Same marker method with warm cache/profile                                                         |
| Renderer responsiveness                    | No long task > 200 ms; input delay <= 100 ms p95 | Browser Performance API in renderer smoke profile                                                  |
| Idle memory footprint                      | <= 300 MB RSS                                    | `process.getProcessMemoryInfo()` sample after 60s idle                                             |
| Typical workload memory footprint          | <= 500 MB RSS                                    | Same sample after open file + update check + one API invoke                                        |
| Idle CPU usage                             | <= 5% average over 60s                           | OS perf counters sampled by profiling script                                                       |
| Typical workload CPU usage                 | <= 25% average during scripted flow              | OS perf counters sampled by profiling script                                                       |
| IPC latency (request/response)             | <= 50 ms p95 for local operations                | Correlation-timed IPC harness in integration test                                                  |

## Automation Policy

- CI compares benchmark outputs against the baseline artifact.
- Regression threshold: >10% on any p95 metric fails CI.
- Performance artifacts are retained for at least 30 days.
- CI enforcement: `.github/workflows/ci.yml` (`perf-check` job) via `pnpm perf:check`.

## Local Profiling Scripts

- `pnpm perf:start` to capture desktop build/startup proxy timings.
- `pnpm perf:ipc` to capture IPC-facing test timing.
- `pnpm perf:memory` to capture local memory samples.
- Local profiling scripts should emit both JSON and a concise console summary.

## Related Standards

- Definition of Done: `docs/05-governance/definition-of-done.md`
- CI checks: `.github/workflows/ci.yml`
- Observability diagnostics: `docs/03-engineering/observability-and-diagnostics.md`
