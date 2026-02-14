import { execSync } from 'node:child_process';
import path from 'node:path';

const trackedFilesOutput = execSync('git ls-files', {
  encoding: 'utf8',
}).trim();
const trackedFiles = trackedFilesOutput.length
  ? trackedFilesOutput.split(/\r?\n/).filter(Boolean)
  : [];

const blockedFiles = trackedFiles.filter((file) => {
  const normalized = file.replaceAll('\\', '/');
  const basename = path.posix.basename(normalized);
  return (
    basename.startsWith('.env') ||
    basename === 'runtime-config.env' ||
    basename === 'runtime-config.env.example'
  );
});

if (blockedFiles.length > 0) {
  console.error('Found blocked .env-style files in repository:');
  for (const file of blockedFiles) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.info('no-dotenv-files: OK');
