import { z } from 'zod';
import { parseOrFailure } from './contracts';
import { apiInvokeRequestSchema } from './api.contract';
import {
  authGetSessionSummaryResponseSchema,
  authSignInRequestSchema,
} from './auth.contract';
import { readTextFileRequestSchema } from './fs.contract';
import { storageSetRequestSchema } from './storage.contract';

describe('parseOrFailure', () => {
  it('should parse valid values', () => {
    const result = parseOrFailure(
      z.object({ name: z.string() }),
      { name: 'ok' },
      'BAD',
      'bad',
    );
    expect(result.ok).toBe(true);
  });

  it('should return failure for invalid values', () => {
    const result = parseOrFailure(
      z.object({ name: z.string() }),
      { name: 10 },
      'BAD',
      'bad',
      { correlationId: 'corr-x', retryable: true },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.correlationId).toBe('corr-x');
      expect(result.error.retryable).toBe(true);
    }
  });
});

describe('readTextFileRequestSchema', () => {
  it('accepts token-based payloads', () => {
    const parsed = readTextFileRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-1',
      payload: {
        fileToken: 'token-123',
        encoding: 'utf8',
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects legacy path-based payloads', () => {
    const parsed = readTextFileRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-2',
      payload: {
        path: 'C:\\temp\\foo.txt',
        encoding: 'utf8',
      },
    });

    expect(parsed.success).toBe(false);
  });
});

describe('apiInvokeRequestSchema', () => {
  it('accepts operation-based API calls', () => {
    const parsed = apiInvokeRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-3',
      payload: {
        operationId: 'status.github',
        params: {
          includeMeta: true,
        },
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects empty operation names', () => {
    const parsed = apiInvokeRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-4',
      payload: {
        operationId: '',
      },
    });

    expect(parsed.success).toBe(false);
  });
});

describe('storageSetRequestSchema', () => {
  it('accepts typed domain/classification payloads', () => {
    const parsed = storageSetRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-5',
      payload: {
        domain: 'settings',
        key: 'theme.mode',
        value: 'light',
        classification: 'internal',
        ttlSeconds: 60,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects unknown storage domains', () => {
    const parsed = storageSetRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-6',
      payload: {
        domain: 'secret',
        key: 'k',
        value: 'v',
      },
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects invalid ttl values', () => {
    const parsed = storageSetRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-7',
      payload: {
        domain: 'cache',
        key: 'k',
        value: 'v',
        ttlSeconds: 0,
      },
    });

    expect(parsed.success).toBe(false);
  });
});

describe('auth contracts', () => {
  it('accepts sign-in requests with empty payload', () => {
    const parsed = authSignInRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-auth-1',
      payload: {},
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts active session summary payloads', () => {
    const parsed = authGetSessionSummaryResponseSchema.safeParse({
      state: 'active',
      userId: 'user-1',
      email: 'user@example.com',
      name: 'Example User',
      expiresAt: '2026-02-12T20:00:00.000Z',
      scopes: ['openid', 'profile'],
      entitlements: ['storage.read'],
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects malformed session summary payloads', () => {
    const parsed = authGetSessionSummaryResponseSchema.safeParse({
      state: 'active',
      email: 'not-an-email',
      scopes: [123],
    });

    expect(parsed.success).toBe(false);
  });
});
