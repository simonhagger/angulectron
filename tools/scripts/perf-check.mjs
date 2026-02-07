import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const outputDir = path.join(repoRoot, 'tmp', 'perf');
const outputPath = path.join(outputDir, 'perf-check.json');
const baselinePath = path.join(repoRoot, 'tools', 'perf', 'baseline.json');

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

const runTimed = (label, command, args) => {
  const start = Date.now();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      NX_DAEMON: 'false',
    },
  });
  const durationMs = Date.now() - start;

  if (result.status !== 0) {
    throw new Error(`${label} failed in ${durationMs}ms`);
  }

  return durationMs;
};

const metrics = {
  desktopMainBuildMs: runTimed('desktop-main build', 'pnpm', [
    'nx',
    'run',
    'desktop-main:build',
  ]),
  desktopPreloadBuildMs: runTimed('desktop-preload build', 'pnpm', [
    'nx',
    'run',
    'desktop-preload:build',
  ]),
  contractsTestMs: runTimed('contracts test', 'pnpm', [
    'nx',
    'run',
    'contracts:test',
  ]),
};

const thresholdFactor = 1.1;
const regressions = Object.entries(metrics)
  .filter(([name, value]) => {
    const base = baseline[name];
    if (typeof base !== 'number') {
      return false;
    }

    return value > base * thresholdFactor;
  })
  .map(([name, value]) => ({
    metric: name,
    measuredMs: value,
    baselineMs: baseline[name],
    maxAllowedMs: Math.round(baseline[name] * thresholdFactor),
  }));

const report = {
  thresholdFactor,
  baseline,
  metrics,
  regressions,
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log('Performance regression report');
console.table(metrics);
console.log(`Wrote ${outputPath}`);

if (regressions.length > 0) {
  console.error('Performance regression detected:');
  console.table(regressions);
  process.exit(1);
}
