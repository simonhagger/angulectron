import type {
  ApiOperationDefinition,
  ApiOperationProviderId,
  ApiOperationRequestPolicy,
} from './api-operation-registry';

export type ApiTrustTierId = 'local-high' | 'local-medium' | 'remote-low';

export type ApiTrustTierPolicy = {
  maxParamEntries: number;
  maxHeaderEntries: number;
  maxParamValueChars: number;
  maxHeaderValueChars: number;
  maxRetryAttempts: number;
  maxTimeoutMs: number;
  maxResponseBytes: number;
};

export const API_TRUST_TIER_POLICIES: Record<
  ApiTrustTierId,
  ApiTrustTierPolicy
> = {
  'local-high': {
    maxParamEntries: 64,
    maxHeaderEntries: 32,
    maxParamValueChars: 1_024,
    maxHeaderValueChars: 1_024,
    maxRetryAttempts: 4,
    maxTimeoutMs: 30_000,
    maxResponseBytes: 4_000_000,
  },
  'local-medium': {
    maxParamEntries: 32,
    maxHeaderEntries: 16,
    maxParamValueChars: 512,
    maxHeaderValueChars: 512,
    maxRetryAttempts: 3,
    maxTimeoutMs: 15_000,
    maxResponseBytes: 2_000_000,
  },
  'remote-low': {
    maxParamEntries: 16,
    maxHeaderEntries: 8,
    maxParamValueChars: 256,
    maxHeaderValueChars: 256,
    maxRetryAttempts: 2,
    maxTimeoutMs: 10_000,
    maxResponseBytes: 1_000_000,
  },
};

export const PROVIDER_API_TRUST_TIERS: Record<
  ApiOperationProviderId,
  ApiTrustTierId
> = {
  'external-http': 'remote-low',
  'bundled-http': 'local-medium',
};

export type ApiTrustPolicyDimension = keyof ApiTrustTierPolicy;

export type ApiTrustPolicyViolation = {
  dimension: ApiTrustPolicyDimension;
  declared: number;
  ceiling: number;
};

export type ApiTrustTierEvaluation =
  | { ok: true; tier: ApiTrustTierId }
  | {
      ok: false;
      tier: ApiTrustTierId;
      violations: ApiTrustPolicyViolation[];
    };

export const resolveApiTrustTier = (
  providerId: string,
): ApiTrustTierId | null =>
  (PROVIDER_API_TRUST_TIERS as Record<string, ApiTrustTierId>)[providerId] ??
  null;

const firstDeclaredNumber = (value: number | undefined): number | undefined =>
  typeof value === 'number' ? value : undefined;

export const evaluateApiTrustTier = (
  operation: ApiOperationDefinition,
  tier: ApiTrustTierId,
): ApiTrustTierEvaluation => {
  const policy = API_TRUST_TIER_POLICIES[tier];
  const violations: ApiTrustPolicyViolation[] = [];

  const declaredDimensions: Array<
    [ApiTrustPolicyDimension, number | undefined]
  > = [
    [
      'maxParamEntries',
      firstDeclaredNumber(operation.requestPolicy?.maxParamEntries),
    ],
    [
      'maxHeaderEntries',
      firstDeclaredNumber(operation.requestPolicy?.maxHeaderEntries),
    ],
    [
      'maxParamValueChars',
      firstDeclaredNumber(operation.requestPolicy?.maxParamValueChars),
    ],
    [
      'maxHeaderValueChars',
      firstDeclaredNumber(operation.requestPolicy?.maxHeaderValueChars),
    ],
    ['maxRetryAttempts', firstDeclaredNumber(operation.retry?.maxAttempts)],
    ['maxTimeoutMs', firstDeclaredNumber(operation.timeoutMs)],
    ['maxResponseBytes', firstDeclaredNumber(operation.maxResponseBytes)],
  ];

  for (const [dimension, declared] of declaredDimensions) {
    if (declared === undefined) {
      continue;
    }
    const ceiling = policy[dimension];
    if (declared > ceiling) {
      violations.push({ dimension, declared, ceiling });
    }
  }

  return violations.length > 0
    ? { ok: false, tier, violations }
    : { ok: true, tier };
};

const minDefined = (value: number | undefined, ceiling: number): number =>
  typeof value === 'number' ? Math.min(value, ceiling) : ceiling;

export const clampApiOperationToTier = (
  operation: ApiOperationDefinition,
  tier: ApiTrustTierId,
): ApiOperationDefinition => {
  const policy = API_TRUST_TIER_POLICIES[tier];
  const declaredRequestPolicy: ApiOperationRequestPolicy =
    operation.requestPolicy ?? {};

  return {
    ...operation,
    timeoutMs: minDefined(operation.timeoutMs, policy.maxTimeoutMs),
    maxResponseBytes: minDefined(
      operation.maxResponseBytes,
      policy.maxResponseBytes,
    ),
    retry: operation.retry
      ? {
          ...operation.retry,
          maxAttempts: minDefined(
            operation.retry.maxAttempts,
            policy.maxRetryAttempts,
          ),
        }
      : operation.retry,
    requestPolicy: {
      maxParamEntries: minDefined(
        declaredRequestPolicy.maxParamEntries,
        policy.maxParamEntries,
      ),
      maxHeaderEntries: minDefined(
        declaredRequestPolicy.maxHeaderEntries,
        policy.maxHeaderEntries,
      ),
      maxParamValueChars: minDefined(
        declaredRequestPolicy.maxParamValueChars,
        policy.maxParamValueChars,
      ),
      maxHeaderValueChars: minDefined(
        declaredRequestPolicy.maxHeaderValueChars,
        policy.maxHeaderValueChars,
      ),
    },
  };
};
