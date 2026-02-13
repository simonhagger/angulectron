import { z } from 'zod';
import { parseOrFailure } from './contracts';
import {
  apiGetOperationDiagnosticsResponseSchema,
  apiInvokeRequestSchema,
} from './api.contract';
import { appRuntimeVersionsResponseSchema } from './app.contract';
import {
  authGetTokenDiagnosticsResponseSchema,
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

describe('appRuntimeVersionsResponseSchema', () => {
  it('accepts runtime versions with app environment', () => {
    const parsed = appRuntimeVersionsResponseSchema.safeParse({
      electron: '40.2.1',
      node: '24.13.0',
      chrome: '140.0.0.0',
      appEnvironment: 'staging',
    });

    expect(parsed.success).toBe(true);
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
        headers: {
          'x-trace-id': 'trace-1',
        },
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects unsafe header names', () => {
    const parsed = apiInvokeRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-3b',
      payload: {
        operationId: 'call.secure-endpoint',
        headers: {
          authorization: 'token',
        },
      },
    });

    expect(parsed.success).toBe(false);
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

describe('apiGetOperationDiagnosticsResponseSchema', () => {
  it('accepts configured operation diagnostics payloads', () => {
    const parsed = apiGetOperationDiagnosticsResponseSchema.safeParse({
      operationId: 'call.secure-endpoint',
      configured: true,
      method: 'GET',
      urlTemplate: 'https://api.example.com/users/{{user_id}}/portfolio',
      pathPlaceholders: ['user_id'],
      claimMap: { user_id: 'sub' },
      authType: 'oidc',
    });

    expect(parsed.success).toBe(true);
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

  it('accepts token diagnostics payloads', () => {
    const parsed = authGetTokenDiagnosticsResponseSchema.safeParse({
      sessionState: 'active',
      bearerSource: 'access_token',
      expectedAudience: 'api.adopa.uk',
      accessToken: {
        present: true,
        format: 'jwt',
        claims: {
          iss: 'https://willing-elephant-20.clerk.accounts.dev',
          sub: 'user_abc',
          aud: ['api.adopa.uk'],
          exp: 1770903664,
          iat: 1770900000,
        },
      },
      idToken: {
        present: true,
        format: 'jwt',
        claims: {
          aud: 'TOtjISa3Sgz2sDi2',
        },
      },
    });

    expect(parsed.success).toBe(true);
  });
});
