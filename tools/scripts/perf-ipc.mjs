import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const outputDir = path.join(repoRoot, 'tmp', 'perf');
const outputPath = path.join(outputDir, 'perf-ipc.json');

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
  contractsTestMs: runTimed('contracts test', 'pnpm', [
    'nx',
    'run',
    'contracts:test',
  ]),
  desktopMainTestMs: runTimed('desktop-main test', 'pnpm', [
    'nx',
    'run',
    'desktop-main:test',
  ]),
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');

console.log('Performance IPC metrics');
console.table(metrics);
console.log(`Wrote ${outputPath}`);
