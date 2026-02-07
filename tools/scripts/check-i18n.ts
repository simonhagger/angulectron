import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schema = z.object({
  home: z.object({
    title: z.string().min(1),
    subtitle: z.string().min(1),
    desktopBridge: z.string().min(1),
    connected: z.string().min(1),
    disconnected: z.string().min(1),
    appVersion: z.string().min(1),
    contractVersion: z.string().min(1),
    activeLanguage: z.string().min(1),
    actions: z.string().min(1),
    openFile: z.string().min(1),
    checkUpdates: z.string().min(1),
    trackTelemetry: z.string().min(1),
    useEnglish: z.string().min(1),
    filePreview: z.string().min(1),
    updateStatus: z.string().min(1),
    telemetryStatus: z.string().min(1),
    governanceTitle: z.string().min(1),
    governanceBody: z.string().min(1),
  }),
});

const localePath = path.resolve(
  __dirname,
  '../../apps/renderer/public/i18n/en-US.json',
);
const source = readFileSync(localePath, 'utf8');
const parsed = schema.safeParse(JSON.parse(source));

if (!parsed.success) {
  console.error('i18n validation failed');
  console.error(parsed.error.format());
  process.exit(1);
}

console.log('i18n validation passed');
