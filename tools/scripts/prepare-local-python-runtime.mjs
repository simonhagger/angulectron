import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { get } from 'node:https';
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
const artifactCatalogPath = path.join(
  rootDir,
  'tools',
  'python-runtime-artifacts.json',
);
const artifactCacheRoot = path.join(
  rootDir,
  'build',
  'python-runtime',
  '_artifacts',
  runtimeTarget,
);
const prunePaths = [
  'Doc',
  'Tools',
  path.join('Lib', 'test'),
  path.join('Lib', 'idlelib', 'Icons'),
  path.join('tcl', 'tk8.6', 'demos'),
];

const loadArtifactConfig = () => {
  if (!existsSync(artifactCatalogPath)) {
    return null;
  }

  const raw = JSON.parse(readFileSync(artifactCatalogPath, 'utf8'));
  const targetConfig = raw?.targets?.[runtimeTarget];
  if (!targetConfig || typeof targetConfig !== 'object') {
    return null;
  }

  if (
    typeof targetConfig.url !== 'string' ||
    typeof targetConfig.sha256 !== 'string' ||
    typeof targetConfig.archiveFileName !== 'string'
  ) {
    throw new Error(
      `Invalid artifact catalog entry for target ${runtimeTarget}.`,
    );
  }

  return {
    distribution: String(targetConfig.distribution ?? 'unknown'),
    pythonVersion: String(targetConfig.pythonVersion ?? ''),
    archiveType: String(targetConfig.archiveType ?? 'zip'),
    archiveFileName: targetConfig.archiveFileName,
    url: targetConfig.url,
    sha256: targetConfig.sha256.toLowerCase(),
    executableName: String(targetConfig.executableName ?? 'python.exe'),
  };
};

const sha256File = (filePath) => {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex').toLowerCase();
};

const downloadFile = (url, destinationPath) =>
  new Promise((resolve, reject) => {
    const request = get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        const redirectUrl = new URL(response.headers.location, url).toString();
        response.resume();
        downloadFile(redirectUrl, destinationPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(
          new Error(
            `Failed to download runtime artifact (${response.statusCode ?? 'unknown'}): ${url}`,
          ),
        );
        return;
      }

      mkdirSync(path.dirname(destinationPath), { recursive: true });
      const stream = createWriteStream(destinationPath);
      response.pipe(stream);
      stream.on('finish', () => {
        stream.close();
        resolve(undefined);
      });
      stream.on('error', (error) => reject(error));
    });

    request.on('error', (error) => reject(error));
  });

const extractArchiveToDir = (archivePath, destinationPath) => {
  rmSync(destinationPath, { recursive: true, force: true });
  mkdirSync(destinationPath, { recursive: true });

  if (process.platform === 'win32') {
    execFileSync('tar', ['-xf', archivePath, '-C', destinationPath], {
      cwd: rootDir,
      stdio: 'inherit',
    });
    return;
  }

  throw new Error(
    `Runtime artifact extraction is not implemented for platform ${process.platform}.`,
  );
};

const enableEmbeddedSitePackages = (runtimeDir) => {
  const entries = existsSync(runtimeDir) ? readdirSync(runtimeDir) : [];
  const pthFiles = entries.filter((entry) =>
    entry.toLowerCase().endsWith('._pth'),
  );

  for (const fileName of pthFiles) {
    const pthPath = path.join(runtimeDir, fileName);
    const lines = readFileSync(pthPath, 'utf8').split(/\r?\n/);
    const hasImportSite = lines.some(
      (line) => line.trim() === 'import site' || line.trim() === '#import site',
    );
    const hasSitePackages = lines.some(
      (line) => line.trim() === 'Lib/site-packages',
    );

    const updatedLines = lines.map((line) =>
      line.trim() === '#import site' ? 'import site' : line,
    );
    if (!hasImportSite) {
      updatedLines.push('import site');
    }
    if (!hasSitePackages) {
      updatedLines.splice(1, 0, 'Lib/site-packages');
    }

    writeFileSync(pthPath, `${updatedLines.join('\n')}\n`, 'utf8');
  }
};

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

const artifactConfig = loadArtifactConfig();
const sourceOverrideDir = process.env.PYTHON_RUNTIME_SOURCE_DIR
  ? path.resolve(rootDir, process.env.PYTHON_RUNTIME_SOURCE_DIR)
  : null;
const sourceDir =
  sourceOverrideDir ?? path.join(artifactCacheRoot, 'extracted');

if (!sourceOverrideDir) {
  if (!artifactConfig) {
    throw new Error(
      `No official artifact catalog entry found for target ${runtimeTarget}. Set PYTHON_RUNTIME_SOURCE_DIR to override locally.`,
    );
  }

  const artifactPath = path.join(
    artifactCacheRoot,
    artifactConfig.archiveFileName,
  );
  const downloadedHash = existsSync(artifactPath)
    ? sha256File(artifactPath)
    : null;
  if (downloadedHash !== artifactConfig.sha256) {
    if (existsSync(artifactPath)) {
      rmSync(artifactPath, { force: true });
    }
    console.info(`Downloading runtime artifact: ${artifactConfig.url}`);
    await downloadFile(artifactConfig.url, artifactPath);
  }

  const verifiedHash = sha256File(artifactPath);
  if (verifiedHash !== artifactConfig.sha256) {
    throw new Error(
      `Artifact checksum mismatch for ${artifactConfig.archiveFileName}. expected=${artifactConfig.sha256} actual=${verifiedHash}`,
    );
  }

  extractArchiveToDir(artifactPath, sourceDir);
}

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
enableEmbeddedSitePackages(outputRuntimeDir);

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
    ? (artifactConfig?.executableName ??
      (path.basename(pythonExecutable).toLowerCase().endsWith('.exe')
        ? path.basename(pythonExecutable)
        : 'python.exe'))
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
    kind: sourceOverrideDir ? 'local-override' : 'official-artifact',
    pythonExecutable,
    sourceDir,
    runtimeTarget,
    artifact:
      sourceOverrideDir || !artifactConfig
        ? null
        : {
            distribution: artifactConfig.distribution,
            pythonVersion: artifactConfig.pythonVersion,
            url: artifactConfig.url,
            archiveFileName: artifactConfig.archiveFileName,
            archiveType: artifactConfig.archiveType,
            sha256: artifactConfig.sha256,
          },
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
