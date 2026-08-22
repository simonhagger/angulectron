import { describe, expect, it } from 'vitest';
import type { ApiOperationDefinition } from './api-operation-registry';
import {
  API_TRUST_TIER_POLICIES,
  clampApiOperationToTier,
  evaluateApiTrustTier,
  resolveApiTrustTier,
} from './api-trust-policy';

describe('resolveApiTrustTier', () => {
  it('maps known providers to their trust tiers', () => {
    expect(resolveApiTrustTier('external-http')).toBe('remote-low');
    expect(resolveApiTrustTier('bundled-http')).toBe('local-medium');
  });

  it('returns null for unknown providers (fail closed)', () => {
    expect(resolveApiTrustTier('docker-local')).toBeNull();
    expect(resolveApiTrustTier('')).toBeNull();
  });
});

describe('evaluateApiTrustTier', () => {
  it('accepts operations whose declared limits fit within the tier', () => {
    const operation: ApiOperationDefinition = {
      method: 'GET',
      url: 'https://example.test/x',
      timeoutMs: 8_000,
      maxResponseBytes: 256_000,
      retry: { maxAttempts: 2 },
      requestPolicy: {
        maxParamEntries: 8,
        maxHeaderEntries: 4,
        maxParamValueChars: 256,
        maxHeaderValueChars: 128,
      },
    };

    const result = evaluateApiTrustTier(operation, 'remote-low');

    expect(result).toEqual({ ok: true, tier: 'remote-low' });
  });

  it('reports violations for every declared limit above the tier ceiling', () => {
    const operation: ApiOperationDefinition = {
      method: 'GET',
      url: 'https://example.test/x',
      timeoutMs: 20_000,
      maxResponseBytes: 3_000_000,
      retry: { maxAttempts: 5 },
      requestPolicy: {
        maxParamEntries: 40,
        maxHeaderEntries: 16,
        maxParamValueChars: 512,
        maxHeaderValueChars: 300,
      },
    };

    const result = evaluateApiTrustTier(operation, 'remote-low');

    if (result.ok) {
      throw new Error('expected violations');
    }
    const dimensions = result.violations.map((v) => v.dimension);
    expect(dimensions).toEqual([
      'maxParamEntries',
      'maxHeaderEntries',
      'maxParamValueChars',
      'maxHeaderValueChars',
      'maxRetryAttempts',
      'maxTimeoutMs',
      'maxResponseBytes',
    ]);
    expect(result.tier).toBe('remote-low');
  });

  it('accepts undeclared dimensions without inventing violations', () => {
    const operation: ApiOperationDefinition = {
      method: 'GET',
      url: 'https://example.test/x',
    };

    expect(evaluateApiTrustTier(operation, 'local-medium')).toEqual({
      ok: true,
      tier: 'local-medium',
    });
  });

  it('treats declared limits equal to the ceiling as compliant', () => {
    const remoteCeilings = API_TRUST_TIER_POLICIES['remote-low'];
    const operation: ApiOperationDefinition = {
      method: 'GET',
      url: 'https://example.test/x',
      timeoutMs: remoteCeilings.maxTimeoutMs,
      maxResponseBytes: remoteCeilings.maxResponseBytes,
      retry: { maxAttempts: remoteCeilings.maxRetryAttempts },
      requestPolicy: {
        maxParamEntries: remoteCeilings.maxParamEntries,
        maxHeaderEntries: remoteCeilings.maxHeaderEntries,
        maxParamValueChars: remoteCeilings.maxParamValueChars,
        maxHeaderValueChars: remoteCeilings.maxHeaderValueChars,
      },
    };

    expect(evaluateApiTrustTier(operation, 'remote-low')).toEqual({
      ok: true,
      tier: 'remote-low',
    });
  });
});

describe('clampApiOperationToTier', () => {
  it('applies tier ceilings to every dimension including undeclared ones', () => {
    const operation: ApiOperationDefinition = {
      method: 'GET',
      url: 'https://example.test/x',
      retry: { maxAttempts: 9, baseDelayMs: 100 },
    };

    const clamped = clampApiOperationToTier(operation, 'local-medium');

    expect(clamped.timeoutMs).toBe(
      API_TRUST_TIER_POLICIES['local-medium'].maxTimeoutMs,
    );
    expect(clamped.maxResponseBytes).toBe(
      API_TRUST_TIER_POLICIES['local-medium'].maxResponseBytes,
    );
    expect(clamped.retry?.maxAttempts).toBe(3);
    expect(clamped.retry?.baseDelayMs).toBe(100);
    expect(clamped.requestPolicy).toEqual({
      maxParamEntries: 32,
      maxHeaderEntries: 16,
      maxParamValueChars: 512,
      maxHeaderValueChars: 512,
    });
  });

  it('keeps declared limits that are stricter than the tier ceiling', () => {
    const operation: ApiOperationDefinition = {
      method: 'GET',
      url: 'https://example.test/x',
      timeoutMs: 1_500,
      requestPolicy: {
        maxParamEntries: 4,
        maxHeaderEntries: 2,
        maxParamValueChars: 64,
        maxHeaderValueChars: 64,
      },
    };

    const clamped = clampApiOperationToTier(operation, 'remote-low');

    expect(clamped.timeoutMs).toBe(1_500);
    expect(clamped.requestPolicy).toEqual({
      maxParamEntries: 4,
      maxHeaderEntries: 2,
      maxParamValueChars: 64,
      maxHeaderValueChars: 64,
    });
  });

  it('does not mutate the source operation', () => {
    const operation: ApiOperationDefinition = {
      method: 'GET',
      url: 'https://example.test/x',
      timeoutMs: 99_000,
    };

    clampApiOperationToTier(operation, 'remote-low');

    expect(operation.timeoutMs).toBe(99_000);
  });
});
