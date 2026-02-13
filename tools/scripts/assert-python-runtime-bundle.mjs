import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const runtimeTarget =
  process.env.PYTHON_RUNTIME_TARGET ?? `${process.platform}-${process.arch}`;
const runtimeRoot = path.join(
  rootDir,
  'build',
  'python-runtime',
  runtimeTarget,
);
const manifestPath = path.join(runtimeRoot, 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error(
    [
      'python-runtime assertion failed: manifest missing.',
      `Expected: ${manifestPath}`,
      'Provide local bundled runtime files under:',
      `build/python-runtime/${runtimeTarget}`,
    ].join('\n'),
  );
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error(
    `python-runtime assertion failed: invalid JSON manifest at ${manifestPath}\n${String(error)}`,
  );
  process.exit(1);
}

if (
  !manifest ||
  typeof manifest !== 'object' ||
  typeof manifest.executableRelativePath !== 'string' ||
  manifest.executableRelativePath.trim().length === 0
) {
  console.error(
    [
      'python-runtime assertion failed: manifest must include non-empty "executableRelativePath".',
      `Manifest: ${manifestPath}`,
    ].join('\n'),
  );
  process.exit(1);
}

const executablePath = path.join(runtimeRoot, manifest.executableRelativePath);
if (!existsSync(executablePath)) {
  console.error(
    [
      'python-runtime assertion failed: interpreter executable missing.',
      `Expected executable: ${executablePath}`,
      `Manifest: ${manifestPath}`,
    ].join('\n'),
  );
  process.exit(1);
}

const manifestPackages = Array.isArray(manifest.packages)
  ? manifest.packages
  : [];
for (const pkg of manifestPackages) {
  if (!pkg || typeof pkg !== 'object') {
    continue;
  }

  if (String(pkg.version ?? '') === 'not-installed') {
    console.error(
      [
        'python-runtime assertion failed: manifest package version is not-installed.',
        `Package: ${String(pkg.name ?? '<unknown>')}`,
        `Manifest: ${manifestPath}`,
      ].join('\n'),
    );
    process.exit(1);
  }
}

const hasPyMuPdfPackage = manifestPackages.some((pkg) => {
  if (!pkg || typeof pkg !== 'object') {
    return false;
  }

  const name = String(pkg.name ?? '').toLowerCase();
  return name === 'pymupdf';
});

if (hasPyMuPdfPackage) {
  try {
    const fitzVersion = execFileSync(
      executablePath,
      ['-c', 'import fitz; print(getattr(fitz, "VersionBind", "unknown"))'],
      { cwd: runtimeRoot, encoding: 'utf8' },
    ).trim();

    if (!fitzVersion) {
      throw new Error('fitz import succeeded but version output was empty');
    }
  } catch (error) {
    console.error(
      [
        'python-runtime assertion failed: bundled runtime cannot import fitz (PyMuPDF).',
        `Executable: ${executablePath}`,
        `Manifest: ${manifestPath}`,
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      ].join('\n'),
    );
    process.exit(1);
  }
}

console.info(
  `python-runtime assertion passed: target=${runtimeTarget}, executable=${manifest.executableRelativePath}`,
);
