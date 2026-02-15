import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { runtimeConfigDocumentSchema } from '@electron-foundation/contracts';

const runtimeConfigFileNames = ['runtime-config.json'];

export const runtimeManagedEnvKeys = [
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
] as const;

const allowedRuntimeConfigKeys = new Set<string>(runtimeManagedEnvKeys);

const toEnvEntriesFromRuntimeConfigDocument = (
  document: ReturnType<typeof runtimeConfigDocumentSchema.parse>,
): Record<string, string> => {
  const entries: Record<string, string> = {};
  const apiConfig = document.api;
  const appConfig = document.app;
  const authConfig = document.auth;

  if (apiConfig?.secureEndpointUrlTemplate) {
    entries.API_SECURE_ENDPOINT_URL_TEMPLATE =
      apiConfig.secureEndpointUrlTemplate;
  } else if (appConfig?.secureEndpointUrlTemplate) {
    entries.API_SECURE_ENDPOINT_URL_TEMPLATE =
      appConfig.secureEndpointUrlTemplate;
  }

  if (apiConfig?.secureEndpointClaimMap) {
    entries.API_SECURE_ENDPOINT_CLAIM_MAP = JSON.stringify(
      apiConfig.secureEndpointClaimMap,
    );
  } else if (appConfig?.secureEndpointClaimMap) {
    entries.API_SECURE_ENDPOINT_CLAIM_MAP = JSON.stringify(
      appConfig.secureEndpointClaimMap,
    );
  }

  if (authConfig?.issuer) {
    entries.OIDC_ISSUER = authConfig.issuer;
  }
  if (authConfig?.clientId) {
    entries.OIDC_CLIENT_ID = authConfig.clientId;
  }
  if (authConfig?.redirectUri) {
    entries.OIDC_REDIRECT_URI = authConfig.redirectUri;
  }
  if (authConfig?.scopes) {
    entries.OIDC_SCOPES = authConfig.scopes;
  }
  if (authConfig?.audience) {
    entries.OIDC_AUDIENCE = authConfig.audience;
  }
  if (typeof authConfig?.sendAudienceInAuthorize === 'boolean') {
    entries.OIDC_SEND_AUDIENCE_IN_AUTHORIZE = authConfig.sendAudienceInAuthorize
      ? '1'
      : '0';
  }
  if (authConfig?.apiBearerTokenSource) {
    entries.OIDC_API_BEARER_TOKEN_SOURCE = authConfig.apiBearerTokenSource;
  }
  if (authConfig?.allowedSignOutOrigins) {
    entries.OIDC_ALLOWED_SIGNOUT_ORIGINS = authConfig.allowedSignOutOrigins;
  }

  return entries;
};

const parseJsonConfig = (raw: string): Record<string, string> => {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const nestedConfig = runtimeConfigDocumentSchema.safeParse(parsed);
  if (nestedConfig.success) {
    return toEnvEntriesFromRuntimeConfigDocument(nestedConfig.data);
  }

  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!allowedRuntimeConfigKeys.has(key) || typeof value !== 'string') {
      continue;
    }

    entries[key] = value;
  }

  return entries;
};

export const syncRuntimeConfigDocumentToEnv = (
  document: ReturnType<typeof runtimeConfigDocumentSchema.parse>,
  env: NodeJS.ProcessEnv = process.env,
): { appliedKeys: string[]; clearedKeys: string[] } => {
  const entries = toEnvEntriesFromRuntimeConfigDocument(document);
  const entryKeys = new Set(Object.keys(entries));
  const appliedKeys: string[] = [];
  const clearedKeys: string[] = [];

  for (const key of runtimeManagedEnvKeys) {
    if (!entryKeys.has(key)) {
      if (typeof env[key] === 'string') {
        delete env[key];
        clearedKeys.push(key);
      }
      continue;
    }

    env[key] = entries[key]!;
    appliedKeys.push(key);
  }

  return { appliedKeys, clearedKeys };
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
    const entries = parseJsonConfig(raw);
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
