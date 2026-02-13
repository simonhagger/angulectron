import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = process.cwd();
const docsIndexPath = 'docs/docs-index.md';

const fail = (message) => {
  console.error(`docs-lint: ${message}`);
};

const normalizePath = (value) => value.replaceAll('\\', '/');

const getDocsFiles = () => {
  const output = execSync('rg --files docs -g "*.md"', {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();

  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((value) => normalizePath(value.trim()))
    .filter(Boolean)
    .sort();
};

const readText = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

const toRepoRelative = (fromFile, target) => {
  const fromDir = dirname(resolve(repoRoot, fromFile));
  const resolved = resolve(fromDir, target);
  return normalizePath(relative(repoRoot, resolved));
};

const collectMarkdownRefs = (file, text) => {
  const refs = [];

  const linkRegex = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of text.matchAll(linkRegex)) {
    const raw = match[1].trim();
    if (
      !raw ||
      raw.startsWith('#') ||
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('mailto:')
    ) {
      continue;
    }

    const noAnchor = raw.split('#')[0];
    if (!noAnchor || !noAnchor.endsWith('.md')) {
      continue;
    }

    const ref = normalizePath(noAnchor);
    refs.push(ref.startsWith('.') ? toRepoRelative(file, ref) : ref);
  }

  const inlineRegex = /`([^`]+\.md)`/g;
  for (const match of text.matchAll(inlineRegex)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('http://') || raw.startsWith('https://')) {
      continue;
    }

    const ref = normalizePath(raw);
    refs.push(ref.startsWith('.') ? toRepoRelative(file, ref) : ref);
  }

  return refs;
};

const errors = [];
const docsFiles = getDocsFiles();
const docsWithoutIndex = docsFiles.filter((file) => file !== docsIndexPath);

if (!existsSync(resolve(repoRoot, docsIndexPath))) {
  errors.push(`Missing required index file: ${docsIndexPath}`);
} else {
  const indexText = readText(docsIndexPath);
  const indexRefs = new Set(
    [...indexText.matchAll(/`(docs\/[A-Za-z0-9_.\/-]+\.md)`/g)].map((match) =>
      normalizePath(match[1]),
    ),
  );

  for (const doc of docsWithoutIndex) {
    if (!indexRefs.has(doc)) {
      errors.push(`docs-index missing entry for ${doc}`);
    }
  }
}

for (const file of docsFiles) {
  const text = readText(file);

  if (!/^Owner:\s+.+$/m.test(text)) {
    errors.push(`${file}: missing Owner header`);
  }

  if (!/^Review cadence:\s+.+$/m.test(text)) {
    errors.push(`${file}: missing Review cadence header`);
  }

  const reviewedMatch = text.match(/^Last reviewed:\s+(.+)$/m);
  if (!reviewedMatch) {
    errors.push(`${file}: missing Last reviewed header`);
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedMatch[1].trim())) {
    errors.push(`${file}: Last reviewed must use YYYY-MM-DD`);
  }

  const refs = collectMarkdownRefs(file, text);
  for (const ref of refs) {
    const resolved = resolve(repoRoot, ref);
    if (!existsSync(resolved)) {
      errors.push(`${file}: broken markdown reference -> ${ref}`);
    }
  }
}

if (errors.length > 0) {
  for (const err of errors) {
    fail(err);
  }
  process.exit(1);
}

console.info(`docs-lint: OK (${docsFiles.length} docs checked)`);
