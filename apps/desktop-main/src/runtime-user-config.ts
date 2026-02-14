import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const runtimeConfigFileNames = ['runtime-config.json', 'runtime-config.env'];

const allowedRuntimeConfigKeys = new Set([
  'OIDC_ISSUER',
  'OIDC_CLIENT_ID',
  'OIDC_REDIRECT_URI',
  'OIDC_SCOPES',
  'OIDC_AUDIENCE',
  'OIDC_SEND_AUDIENCE_IN_AUTHORIZE',
  'OIDC_API_BEARER_TOKEN_SOURCE',
  'OIDC_ALLOWED_SIGNOUT_ORIGINS',
  'API_SECURE_ENDPOINT_URL_TEMPLATE',
  'API_SECURE_ENDPOINT_CLAIM_MAP',
]);

const stripWrappingQuotes = (value: string): string => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
};

const parseEnvConfig = (raw: string): Record<string, string> => {
  const entries: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = stripWrappingQuotes(trimmed.slice(separator + 1).trim());
    if (!key || !allowedRuntimeConfigKeys.has(key)) {
      continue;
    }

    entries[key] = value;
  }

  return entries;
};

const parseJsonConfig = (raw: string): Record<string, string> => {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!allowedRuntimeConfigKeys.has(key) || typeof value !== 'string') {
      continue;
    }

    entries[key] = value;
  }

  return entries;
};

const findRuntimeConfigPath = (userDataPath: string): string | null => {
  const configDir = path.join(userDataPath, 'config');
  for (const fileName of runtimeConfigFileNames) {
    const fullPath = path.join(configDir, fileName);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
};

export type RuntimeConfigLoadResult = {
  sourcePath: string | null;
  appliedKeys: string[];
  skippedExistingKeys: string[];
  parseError?: string;
};

export const loadUserRuntimeConfig = (
  userDataPath: string,
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfigLoadResult => {
  const sourcePath = findRuntimeConfigPath(userDataPath);
  if (!sourcePath) {
    return {
      sourcePath: null,
      appliedKeys: [],
      skippedExistingKeys: [],
    };
  }

  try {
    const raw = readFileSync(sourcePath, 'utf8');
    const entries = sourcePath.endsWith('.json')
      ? parseJsonConfig(raw)
      : parseEnvConfig(raw);
    const appliedKeys: string[] = [];
    const skippedExistingKeys: string[] = [];
    for (const [key, value] of Object.entries(entries)) {
      if (typeof env[key] === 'string' && env[key]!.trim().length > 0) {
        skippedExistingKeys.push(key);
        continue;
      }

      env[key] = value;
      appliedKeys.push(key);
    }

    return {
      sourcePath,
      appliedKeys,
      skippedExistingKeys,
    };
  } catch (error) {
    return {
      sourcePath,
      appliedKeys: [],
      skippedExistingKeys: [],
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
};
