import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const outputDir = path.join(repoRoot, 'tmp', 'perf');
const outputPath = path.join(outputDir, 'perf-memory.json');

const toMb = (bytes) => Number((bytes / (1024 * 1024)).toFixed(2));

const idle = process.memoryUsage();
const temp = Buffer.alloc(10 * 1024 * 1024);
const typical = process.memoryUsage();
temp.fill(1);

const metrics = {
  idleRssMb: toMb(idle.rss),
  typicalRssMb: toMb(typical.rss),
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');

console.log('Performance memory metrics');
console.table(metrics);
console.log(`Wrote ${outputPath}`);
