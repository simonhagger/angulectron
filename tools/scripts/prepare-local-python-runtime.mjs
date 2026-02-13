import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const runtimeTarget =
  process.env.PYTHON_RUNTIME_TARGET ?? `${process.platform}-${process.arch}`;
const outputRoot = path.join(rootDir, 'build', 'python-runtime', runtimeTarget);
const outputRuntimeDir = path.join(outputRoot, 'python');
const outputSitePackagesDir = path.join(
  outputRuntimeDir,
  'Lib',
  'site-packages',
);
const requirementsFilePath = process.env.PYTHON_RUNTIME_REQUIREMENTS
  ? path.resolve(rootDir, process.env.PYTHON_RUNTIME_REQUIREMENTS)
  : path.join(
      rootDir,
      'apps',
      'desktop-main',
      'python-sidecar',
      'requirements-runtime.txt',
    );
const prunePaths = [
  'Doc',
  'Tools',
  path.join('Lib', 'test'),
  path.join('Lib', 'idlelib', 'Icons'),
  path.join('tcl', 'tk8.6', 'demos'),
];

const resolvePythonCommand = () => {
  if (process.env.PYTHON) {
    return { command: process.env.PYTHON, args: [] };
  }

  if (process.platform === 'win32') {
    try {
      execFileSync('py', ['-3', '--version'], { stdio: 'ignore' });
      return { command: 'py', args: ['-3'] };
    } catch {
      return { command: 'python', args: [] };
    }
  }

  return { command: 'python3', args: [] };
};

const python = resolvePythonCommand();

const pythonExecutable = execFileSync(
  python.command,
  [...python.args, '-c', 'import sys; print(sys.executable)'],
  { cwd: rootDir, encoding: 'utf8' },
).trim();

const sourceDir = process.env.PYTHON_RUNTIME_SOURCE_DIR
  ? path.resolve(rootDir, process.env.PYTHON_RUNTIME_SOURCE_DIR)
  : path.dirname(pythonExecutable);

const parseRequirementPackageNames = (requirementsPath) => {
  if (!existsSync(requirementsPath)) {
    return [];
  }

  return readFileSync(requirementsPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 && !line.startsWith('#') && !line.startsWith('-'),
    )
    .map((line) => line.split(/[<>=!~;\[]/, 1)[0]?.trim() ?? '')
    .filter((name) => name.length > 0);
};

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });
cpSync(sourceDir, outputRuntimeDir, { recursive: true });

for (const relativePath of prunePaths) {
  rmSync(path.join(outputRuntimeDir, relativePath), {
    recursive: true,
    force: true,
  });
}

rmSync(outputSitePackagesDir, { recursive: true, force: true });
mkdirSync(outputSitePackagesDir, { recursive: true });

const executableName =
  process.platform === 'win32'
    ? path.basename(pythonExecutable).toLowerCase().endsWith('.exe')
      ? path.basename(pythonExecutable)
      : 'python.exe'
    : path.basename(pythonExecutable);
const runtimePythonExecutablePath = path.join(outputRuntimeDir, executableName);

if (existsSync(requirementsFilePath)) {
  execFileSync(
    python.command,
    [
      ...python.args,
      '-m',
      'pip',
      'install',
      '--disable-pip-version-check',
      '--requirement',
      requirementsFilePath,
      '--target',
      outputSitePackagesDir,
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );
}

const packageNamesFromRequirements =
  parseRequirementPackageNames(requirementsFilePath);
const packageNamesFromEnv = (process.env.PYTHON_RUNTIME_PACKAGES ?? 'PyMuPDF')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const packageNames =
  packageNamesFromRequirements.length > 0
    ? packageNamesFromRequirements
    : packageNamesFromEnv;

const packageVersions = packageNames.map((name) => {
  const version = execFileSync(
    runtimePythonExecutablePath,
    [
      '-c',
      [
        'import importlib.metadata as m',
        `name = ${JSON.stringify(name)}`,
        'try:',
        '    print(m.version(name))',
        'except m.PackageNotFoundError:',
        '    print("not-installed")',
      ].join('\n'),
    ],
    { cwd: rootDir, encoding: 'utf8' },
  ).trim();

  return { name, version };
});

const runtimePythonVersion = execFileSync(
  runtimePythonExecutablePath,
  ['-c', 'import platform; print(platform.python_version())'],
  { cwd: rootDir, encoding: 'utf8' },
).trim();

const manifest = {
  executableRelativePath: path
    .join('python', executableName)
    .replaceAll('\\', '/'),
  pythonVersion: runtimePythonVersion,
  packages: packageVersions,
  requirements: existsSync(requirementsFilePath)
    ? path.relative(rootDir, requirementsFilePath).replaceAll('\\', '/')
    : null,
  source: {
    pythonExecutable,
    sourceDir,
  },
};

writeFileSync(
  path.join(outputRoot, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.info(`Prepared local python runtime bundle at: ${outputRoot}`);
console.info(`Source: ${sourceDir}`);
console.info(`Executable: ${manifest.executableRelativePath}`);
console.info(`Version: ${runtimePythonVersion}`);
console.info(`Pruned paths: ${prunePaths.join(', ')}`);
console.info(
  `Requirements: ${
    existsSync(requirementsFilePath)
      ? path.relative(rootDir, requirementsFilePath).replaceAll('\\', '/')
      : 'none'
  }`,
);
