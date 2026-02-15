import type { ApiOperationId } from '@electron-foundation/contracts';

const JWT_CLAIM_PATH_PATTERN = /^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*$/;

export type ApiOperationProviderId = 'bundled-http';

export type ApiOperationDefinition = {
  providerId?: ApiOperationProviderId;
  method: 'GET' | 'POST';
  url: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  concurrencyLimit?: number;
  minIntervalMs?: number;
  claimMap?: Record<string, string>;
  auth?:
    | {
        type: 'bearer';
        tokenEnvVar: string;
      }
    | {
        type: 'oidc';
      }
    | {
        type: 'none';
      };
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
  };
};

export type ApiOperationRegistry = Partial<
  Record<ApiOperationId, ApiOperationDefinition>
>;

const operationConfigurationIssues: Partial<Record<ApiOperationId, string>> = {
  'call.secure-endpoint':
    'Set API secure endpoint configuration in Settings or runtime-config.json to enable this operation.',
};

const resolveConfiguredSecureEndpointUrl = (): string | null => {
  const configured = process.env.API_SECURE_ENDPOINT_URL_TEMPLATE?.trim();
  return configured && configured.length > 0 ? configured : null;
};

const resolveConfiguredSecureEndpointClaimMap = (): Record<string, string> => {
  const raw = process.env.API_SECURE_ENDPOINT_CLAIM_MAP?.trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const normalized: Record<string, string> = {};
    for (const [placeholder, claimPath] of Object.entries(parsed)) {
      if (
        typeof placeholder !== 'string' ||
        typeof claimPath !== 'string' ||
        !JWT_CLAIM_PATH_PATTERN.test(claimPath)
      ) {
        continue;
      }
      normalized[placeholder] = claimPath;
    }

    return normalized;
  } catch {
    return {};
  }
};

export const resolveApiOperationRegistryFromEnv = (): ApiOperationRegistry => {
  const configuredSecureEndpointUrl = resolveConfiguredSecureEndpointUrl();
  const configuredSecureEndpointClaimMap =
    resolveConfiguredSecureEndpointClaimMap();

  return {
    'status.github': {
      providerId: 'bundled-http',
      method: 'GET',
      url: 'https://api.github.com/rate_limit',
      timeoutMs: 8_000,
      maxResponseBytes: 256_000,
      concurrencyLimit: 2,
      minIntervalMs: 300,
      auth: { type: 'none' },
    },
    ...(configuredSecureEndpointUrl
      ? {
          'call.secure-endpoint': {
            providerId: 'bundled-http',
            method: 'GET',
            url: configuredSecureEndpointUrl,
            timeoutMs: 10_000,
            maxResponseBytes: 1_000_000,
            concurrencyLimit: 2,
            minIntervalMs: 300,
            claimMap: configuredSecureEndpointClaimMap,
            auth: { type: 'oidc' },
            retry: { maxAttempts: 2, baseDelayMs: 200 },
          },
        }
      : {}),
  };
};

export const getApiOperationConfigurationHint = (
  operationId: ApiOperationId,
): string | undefined => operationConfigurationIssues[operationId];
