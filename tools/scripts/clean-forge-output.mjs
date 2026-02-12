import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const outDir = path.join(workspaceRoot, 'out');

const platformDirPattern = /-(win32|darwin|linux)-/;

const removePath = async (targetPath) => {
  await rm(targetPath, { recursive: true, force: true });
  console.log(`Removed ${path.relative(workspaceRoot, targetPath)}`);
};

const main = async () => {
  await removePath(path.join(outDir, 'make'));

  const entries = await readdir(outDir, { withFileTypes: true }).catch(
    () => [],
  );

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (platformDirPattern.test(entry.name)) {
      await removePath(path.join(outDir, entry.name));
    }
  }
};

main().catch((error) => {
  console.error('Failed to clean forge output.', error);
  process.exit(1);
});
