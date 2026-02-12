import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const desktopMainEntry = path.resolve(
  workspaceRoot,
  'dist/apps/desktop-main/main.js',
);

if (!existsSync(desktopMainEntry)) {
  console.error('Runtime smoke failed: desktop main entry was not found.');
  console.error(`Expected: ${desktopMainEntry}`);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const timeoutMs = 25_000;
const launchEnv = {
  ...process.env,
  NODE_ENV: 'production',
  RUNTIME_SMOKE: '1',
};
delete launchEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, [desktopMainEntry], {
  cwd: workspaceRoot,
  env: launchEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
let settled = false;

child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');

child.stdout.on('data', (chunk) => {
  stdout += chunk;
  process.stdout.write(chunk);
});

child.stderr.on('data', (chunk) => {
  stderr += chunk;
  process.stderr.write(chunk);
});

const timeout = setTimeout(() => {
  if (settled) {
    return;
  }
  settled = true;
  child.kill('SIGTERM');
  console.error(`Runtime smoke timed out after ${timeoutMs}ms.`);
  process.exit(1);
}, timeoutMs);

child.on('error', (error) => {
  if (settled) {
    return;
  }
  settled = true;
  clearTimeout(timeout);
  console.error(`Runtime smoke failed to launch Electron: ${error.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  if (settled) {
    return;
  }
  settled = true;
  clearTimeout(timeout);

  if (code === 0) {
    console.log('Runtime smoke passed.');
    process.exit(0);
  }

  console.error(`Runtime smoke failed with exit code ${code ?? -1}.`);
  if (stdout.trim().length > 0) {
    console.error('Captured stdout:');
    console.error(stdout.trim());
  }
  if (stderr.trim().length > 0) {
    console.error('Captured stderr:');
    console.error(stderr.trim());
  }
  process.exit(code ?? 1);
});
