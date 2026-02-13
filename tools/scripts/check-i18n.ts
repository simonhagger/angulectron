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
    desktopUnavailable: z.string().min(1),
    selectTextFileTitle: z.string().min(1),
    textFiles: z.string().min(1),
    noFileSelected: z.string().min(1),
    eventAccepted: z.string().min(1),
  }),
});

const baseLocalePath = path.resolve(
  __dirname,
  '../../apps/renderer/public/i18n/en-US.json',
);
const homeLocalePath = path.resolve(
  __dirname,
  '../../apps/renderer/src/app/features/home/i18n/en-US.json',
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeObjects = (
  base: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> => {
  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const baseValue = output[key];
    if (isRecord(baseValue) && isRecord(value)) {
      output[key] = mergeObjects(baseValue, value);
      continue;
    }
    output[key] = value;
  }

  return output;
};

const baseLocale = JSON.parse(readFileSync(baseLocalePath, 'utf8')) as Record<
  string,
  unknown
>;
const homeLocale = JSON.parse(readFileSync(homeLocalePath, 'utf8')) as Record<
  string,
  unknown
>;
const mergedLocale = mergeObjects(baseLocale, homeLocale);

const parsed = schema.safeParse(mergedLocale);

if (!parsed.success) {
  console.error('i18n validation failed');
  console.error(parsed.error.format());
  process.exit(1);
}

console.log('i18n validation passed');
