import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const requirementsPath = path.join(
  rootDir,
  'apps',
  'desktop-main',
  'python-sidecar',
  'requirements-test.txt',
);
const testsPath = path.join(
  rootDir,
  'apps',
  'desktop-main',
  'python-sidecar',
  'tests',
);
const coverageXmlPath = path.join(
  rootDir,
  'coverage',
  'apps',
  'desktop-main',
  'python-sidecar-coverage.xml',
);
const venvDir = path.join(rootDir, '.nx', 'python-sidecar-venv');

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const resolveSystemPython = () => {
  if (process.env.PYTHON) {
    return process.env.PYTHON;
  }

  if (process.platform === 'win32') {
    const pyProbe = spawnSync('py', ['-3', '--version'], {
      cwd: rootDir,
      stdio: 'ignore',
      shell: false,
    });
    if (pyProbe.status === 0) {
      return 'py';
    }
  }

  return 'python';
};

const systemPython = resolveSystemPython();

if (!existsSync(venvDir)) {
  if (systemPython === 'py') {
    run('py', ['-3', '-m', 'venv', venvDir]);
  } else {
    run(systemPython, ['-m', 'venv', venvDir]);
  }
}

const venvPython =
  process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');

run(venvPython, [
  '-m',
  'pip',
  'install',
  '--disable-pip-version-check',
  '-r',
  requirementsPath,
]);
run(venvPython, [
  '-m',
  'pytest',
  '-p',
  'no:cacheprovider',
  testsPath,
  '--cov=apps/desktop-main/src/assets/python_sidecar',
  '--cov-report=term-missing',
  `--cov-report=xml:${coverageXmlPath}`,
  '--cov-fail-under=90',
]);
