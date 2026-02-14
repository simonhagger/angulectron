import { readFileSync } from 'node:fs';

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) {
  console.log('GITHUB_EVENT_PATH not set. Skipping security checklist gate.');
  process.exit(0);
}

const event = JSON.parse(readFileSync(eventPath, 'utf8'));
if (!event.pull_request) {
  console.log('Not a pull request event. Skipping security checklist gate.');
  process.exit(0);
}

const sensitivePatterns = [
  /^apps\/desktop-main\//,
  /^apps\/desktop-preload\//,
  /^libs\/shared\/contracts\//,
  /^\.github\/workflows\//,
  /^docs\/02-architecture\/security-architecture\.md$/,
];

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  console.error('GITHUB_TOKEN is required for security checklist gate.');
  process.exit(1);
}

const filesUrl = `${event.pull_request.url}/files?per_page=100`;
const response = await fetch(filesUrl, {
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${githubToken}`,
    'X-GitHub-Api-Version': '2022-11-28',
  },
});

if (!response.ok) {
  console.error(
    `Failed to load PR files: ${response.status} ${response.statusText}`,
  );
  process.exit(1);
}

const files = await response.json();
const touchedSensitiveFile = files.some((file) =>
  sensitivePatterns.some((pattern) => pattern.test(file.filename)),
);

if (!touchedSensitiveFile) {
  console.log('No security-sensitive files changed. Gate passed.');
  process.exit(0);
}

const body = event.pull_request.body ?? '';
const hasSecurityReview = /- \[x\] Security review completed/i.test(body);
const hasThreatModel = /- \[x\] Threat model updated or N\/A explained/i.test(
  body,
);
const hasNoSecretsConfirmation =
  /- \[x\] Confirmed no secrets\/sensitive data present in committed files/i.test(
    body,
  );

if (!hasSecurityReview || !hasThreatModel || !hasNoSecretsConfirmation) {
  console.error(
    'Security-sensitive change requires completed security checklist in PR body.',
  );
  console.error('Expected checked items:');
  console.error('- [x] Security review completed');
  console.error('- [x] Threat model updated or N/A explained');
  console.error(
    '- [x] Confirmed no secrets/sensitive data present in committed files',
  );
  process.exit(1);
}

console.log('Security checklist gate passed.');
