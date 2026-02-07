import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const requiredArtifacts = [
  'dist/apps/desktop-main/main.js',
  'dist/apps/desktop-preload/main.js',
  'dist/apps/renderer/browser/index.html',
].map((relativePath) => ({
  relativePath,
  absolutePath: path.join(repoRoot, relativePath),
}));

const missing = requiredArtifacts.filter(
  (artifact) => !existsSync(artifact.absolutePath),
);

if (missing.length > 0) {
  console.error('Desktop artifact smoke check failed. Missing files:');
  for (const artifact of missing) {
    console.error(`- ${artifact.relativePath}`);
  }
  process.exit(1);
}

console.log('Desktop artifact smoke check passed.');
for (const artifact of requiredArtifacts) {
  console.log(`- ${artifact.relativePath}`);
}
