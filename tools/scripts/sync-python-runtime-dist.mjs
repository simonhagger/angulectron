import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const runtimeTarget =
  process.env.PYTHON_RUNTIME_TARGET ?? `${process.platform}-${process.arch}`;
const sourceRuntimeDir = path.join(
  rootDir,
  'build',
  'python-runtime',
  runtimeTarget,
);
const destinationRuntimeDir = path.join(
  rootDir,
  'dist',
  'apps',
  'desktop-main',
  'python-runtime',
  runtimeTarget,
);

rmSync(destinationRuntimeDir, {
  recursive: true,
  force: true,
  maxRetries: 5,
  retryDelay: 100,
});

if (!existsSync(sourceRuntimeDir)) {
  console.info(
    `python-runtime dist sync: source not found (${sourceRuntimeDir}); nothing copied.`,
  );
  process.exit(0);
}

mkdirSync(path.dirname(destinationRuntimeDir), { recursive: true });
cpSync(sourceRuntimeDir, destinationRuntimeDir, { recursive: true });

console.info(
  `python-runtime dist sync: copied ${runtimeTarget} -> ${destinationRuntimeDir}`,
);
