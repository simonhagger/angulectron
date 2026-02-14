import { afterEach, describe, expect, it } from 'vitest';
import type {
  ApiInvokeRequest,
  ApiOperationId,
  DesktopResult,
} from '@electron-foundation/contracts';
import {
  getApiOperationDiagnostics,
  invokeApiOperation,
  setOidcAccessTokenResolver,
  type ApiOperation,
} from './api-gateway';

const base64UrlEncode = (value: string) =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const createJwt = (payload: Record<string, unknown>) => {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.signature`;
};

const baseRequest = (
  operationId: ApiOperationId,
  correlationId = 'corr-test',
): ApiInvokeRequest => ({
  contractVersion: '1.0.0',
  correlationId,
  payload: {
    operationId,
  },
});

const expectFailure = (
  result: DesktopResult<{
    status: number;
    data: unknown;
    contentType?: string;
  }>,
) => {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected failure result');
  }
  return (result as Extract<typeof result, { ok: false }>).error;
};

describe('invokeApiOperation', () => {
  afterEach(() => {
    setOidcAccessTokenResolver(null);
  });

  it('rejects unknown operations', async () => {
    const result = await invokeApiOperation(
      {
        contractVersion: '1.0.0',
        correlationId: 'corr-test',
        payload: {
          operationId: 'unknown.op' as unknown as ApiOperationId,
        },
      },
      {
        operations: {},
      },
    );

    const error = expectFailure(result);
    expect(error.code).toBe('API/OPERATION_NOT_ALLOWED');
    expect(error.correlationId).toBe('corr-test');
  });

  it('returns operation-not-configured when BYO endpoint is not provided', async () => {
    const original = process.env.API_SECURE_ENDPOINT_URL_TEMPLATE;
    delete process.env.API_SECURE_ENDPOINT_URL_TEMPLATE;

    const result = await invokeApiOperation(
      baseRequest('call.secure-endpoint'),
      {
        operations: {
          'status.github': {
            method: 'GET',
            url: 'https://api.github.com/rate_limit',
          },
        },
      },
    );

    const error = expectFailure(result);
    expect(error.code).toBe('API/OPERATION_NOT_CONFIGURED');

    if (typeof original === 'string') {
      process.env.API_SECURE_ENDPOINT_URL_TEMPLATE = original;
    }
  });

  it('rejects insecure destinations', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'status.github': { method: 'GET', url: 'http://example.com' },
    };
    const result = await invokeApiOperation(baseRequest('status.github'), {
      operations,
    });

    const error = expectFailure(result);
    expect(error.code).toBe('API/INSECURE_DESTINATION');
  });

  it('blocks redirects to other hosts', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'status.github': { method: 'GET', url: 'https://api.example.com/data' },
    };
    const fetchFn: typeof fetch = async () =>
      new Response('', {
        status: 302,
        headers: {
          location: 'https://evil.example.net/pwn',
        },
      });

    const result = await invokeApiOperation(baseRequest('status.github'), {
      operations,
      fetchFn,
    });

    const error = expectFailure(result);
    expect(error.code).toBe('API/REDIRECT_BLOCKED');
  });

  it('returns timeout for aborted requests', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'status.github': {
        method: 'GET',
        url: 'https://api.example.com/slow',
        timeoutMs: 5,
      },
    };
    const fetchFn: typeof fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });

    const result = await invokeApiOperation(baseRequest('status.github'), {
      operations,
      fetchFn,
    });

    const error = expectFailure(result);
    expect(error.code).toBe('API/TIMEOUT');
  });

  it('returns parsed json data for successful responses', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'status.github': { method: 'GET', url: 'https://api.example.com/ok' },
    };
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ hello: 'world' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });

    const result = await invokeApiOperation(baseRequest('status.github'), {
      operations,
      fetchFn,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe(200);
      expect(result.data.data).toEqual({ hello: 'world' });
      expect(result.data.requestPath).toBe('/ok');
    }
  });

  it('rejects successful non-json responses', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'status.github': { method: 'GET', url: 'https://api.example.com/text' },
    };
    const fetchFn: typeof fetch = async () =>
      new Response('ok', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });

    const result = await invokeApiOperation(baseRequest('status.github'), {
      operations,
      fetchFn,
    });

    const error = expectFailure(result);
    expect(error.code).toBe('API/UNSUPPORTED_CONTENT_TYPE');
  });

  it('returns auth-required classification for 401 responses', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'status.github': {
        method: 'GET',
        url: 'https://api.example.com/protected',
      },
    };
    const fetchFn: typeof fetch = async () =>
      new Response('nope', {
        status: 401,
      });

    const result = await invokeApiOperation(baseRequest('status.github'), {
      operations,
      fetchFn,
    });

    const error = expectFailure(result);
    expect(error.code).toBe('API/AUTH_REQUIRED');
  });

  it('rejects bearer-auth operations when credentials are missing', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'status.github': {
        method: 'GET',
        url: 'https://api.example.com/secure',
        auth: {
          type: 'bearer',
          tokenEnvVar: 'ELECTRON_API_TOKEN_TEST',
        },
      },
    };

    delete process.env.ELECTRON_API_TOKEN_TEST;

    const result = await invokeApiOperation(baseRequest('status.github'), {
      operations,
    });

    const error = expectFailure(result);
    expect(error.code).toBe('API/CREDENTIALS_UNAVAILABLE');
  });

  it('rejects oidc-auth operations when no session token is available', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'status.github': {
        method: 'GET',
        url: 'https://api.example.com/secure',
        auth: {
          type: 'oidc',
        },
      },
    };
    setOidcAccessTokenResolver(() => null);

    const result = await invokeApiOperation(baseRequest('status.github'), {
      operations,
    });

    const error = expectFailure(result);
    expect(error.code).toBe('API/AUTH_REQUIRED');
  });

  it('attaches oidc bearer token when resolver returns an access token', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'status.github': {
        method: 'GET',
        url: 'https://api.example.com/secure',
        auth: {
          type: 'oidc',
        },
      },
    };
    setOidcAccessTokenResolver(() => 'oidc-token-123');

    let authHeader = '';
    const fetchFn: typeof fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      authHeader = headers.get('Authorization') ?? '';
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    };

    const result = await invokeApiOperation(baseRequest('status.github'), {
      operations,
      fetchFn,
    });

    expect(result.ok).toBe(true);
    expect(authHeader).toBe('Bearer oidc-token-123');
  });

  it('returns auth-required when backend rejects wrong-audience oidc token', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'call.secure-endpoint': {
        method: 'GET',
        url: 'https://api.example.com/{{user_id}}',
        auth: {
          type: 'oidc',
        },
      },
    };
    setOidcAccessTokenResolver(() =>
      createJwt({
        iss: 'https://issuer.example.com',
        sub: 'user-1',
        aud: 'wrong-audience',
      }),
    );

    const fetchFn: typeof fetch = async (_input, init) => {
      const authHeader = new Headers(init?.headers).get('Authorization') ?? '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const payloadSegment = token.split('.')[1] ?? '';
      const payloadJson = Buffer.from(payloadSegment, 'base64url').toString(
        'utf8',
      );
      const payload = JSON.parse(payloadJson) as { aud?: unknown };
      const isValidAudience =
        payload.aud === 'api://secure-endpoint' ||
        (Array.isArray(payload.aud) &&
          payload.aud.includes('api://secure-endpoint'));

      if (!isValidAudience) {
        return new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const result = await invokeApiOperation(
      {
        contractVersion: '1.0.0',
        correlationId: 'corr-test',
        payload: {
          operationId: 'call.secure-endpoint',
          params: { user_id: 'user-1' },
        },
      },
      {
        operations,
        fetchFn,
      },
    );

    const error = expectFailure(result);
    expect(error.code).toBe('API/AUTH_REQUIRED');
  });

  it('returns success when backend accepts valid-audience oidc token', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'call.secure-endpoint': {
        method: 'GET',
        url: 'https://api.example.com/{{user_id}}',
        auth: {
          type: 'oidc',
        },
      },
    };
    setOidcAccessTokenResolver(() =>
      createJwt({
        iss: 'https://issuer.example.com',
        sub: 'user-1',
        aud: ['api://secure-endpoint'],
      }),
    );

    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    const result = await invokeApiOperation(
      {
        contractVersion: '1.0.0',
        correlationId: 'corr-test',
        payload: {
          operationId: 'call.secure-endpoint',
          params: { user_id: 'user-1' },
        },
      },
      {
        operations,
        fetchFn,
      },
    );

    expect(result.ok).toBe(true);
  });

  it('injects path params into operation url and omits them from query string', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'call.secure-endpoint': {
        method: 'GET',
        url: 'https://api.example.com/{{user_id}}',
        auth: {
          type: 'oidc',
        },
      },
    };
    setOidcAccessTokenResolver(() => 'oidc-token-123');

    let requestedUrl = '';
    const fetchFn: typeof fetch = async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    };

    const result = await invokeApiOperation(
      {
        contractVersion: '1.0.0',
        correlationId: 'corr-test',
        payload: {
          operationId: 'call.secure-endpoint',
          params: {
            user_id: 'user-123',
            include: 'positions',
          },
        },
      },
      {
        operations,
        fetchFn,
      },
    );

    expect(result.ok).toBe(true);
    expect(requestedUrl).toContain('/user-123');
    expect(requestedUrl).toContain('include=positions');
    expect(requestedUrl).not.toContain('user_id=');
  });

  it('returns invalid-params when required path placeholders are missing', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'call.secure-endpoint': {
        method: 'GET',
        url: 'https://api.example.com/{{user_id}}',
      },
    };

    const result = await invokeApiOperation(
      {
        contractVersion: '1.0.0',
        correlationId: 'corr-test',
        payload: {
          operationId: 'call.secure-endpoint',
          params: {
            include: 'positions',
          },
        },
      },
      {
        operations,
      },
    );

    const error = expectFailure(result);
    expect(error.code).toBe('API/INVALID_PARAMS');
  });

  it('maps configured jwt claim paths into endpoint placeholders', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'call.secure-endpoint': {
        method: 'GET',
        url: 'https://api.example.com/{{user_id}}/tenant/{{tenant_id}}',
        claimMap: {
          user_id: 'sub',
          tenant_id: 'org.id',
        },
        auth: {
          type: 'oidc',
        },
      },
    };
    setOidcAccessTokenResolver(() =>
      createJwt({
        sub: 'user-from-jwt',
        org: { id: 'tenant-from-jwt' },
      }),
    );

    let requestedUrl = '';
    const fetchFn: typeof fetch = async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const result = await invokeApiOperation(
      baseRequest('call.secure-endpoint'),
      {
        operations,
        fetchFn,
      },
    );

    expect(result.ok).toBe(true);
    expect(requestedUrl).toContain('/user-from-jwt/tenant/tenant-from-jwt');
  });

  it('rejects unsafe request header names', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'call.secure-endpoint': {
        method: 'GET',
        url: 'https://api.example.com/{{user_id}}',
      },
    };

    const result = await invokeApiOperation(
      {
        contractVersion: '1.0.0',
        correlationId: 'corr-test',
        payload: {
          operationId: 'call.secure-endpoint',
          params: { user_id: 'user-1' },
          headers: {
            authorization: 'bad-override',
          },
        },
      },
      {
        operations,
      },
    );

    const error = expectFailure(result);
    expect(error.code).toBe('API/INVALID_HEADERS');
  });

  it('retries GET requests for retryable errors', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'status.github': {
        method: 'GET',
        url: 'https://api.example.com/retry',
        retry: { maxAttempts: 2, baseDelayMs: 1 },
      },
    };
    let attempts = 0;
    const fetchFn: typeof fetch = async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new TypeError('network is unreachable');
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const result = await invokeApiOperation(baseRequest('status.github'), {
      operations,
      fetchFn,
    });

    expect(result.ok).toBe(true);
    expect(attempts).toBe(2);
  });

  it('does not retry non-idempotent POST requests', async () => {
    const operations: Partial<Record<ApiOperationId, ApiOperation>> = {
      'status.github': {
        method: 'POST',
        url: 'https://api.example.com/write',
        retry: { maxAttempts: 3, baseDelayMs: 1 },
      },
    };
    let attempts = 0;
    const fetchFn: typeof fetch = async () => {
      attempts += 1;
      throw new TypeError('network is unreachable');
    };

    const result = await invokeApiOperation(baseRequest('status.github'), {
      operations,
      fetchFn,
    });

    const error = expectFailure(result);
    expect(error.code).toBe('API/OFFLINE');
    expect(attempts).toBe(1);
  });
});

describe('getApiOperationDiagnostics', () => {
  it('returns configured diagnostics for known operations', () => {
    const result = getApiOperationDiagnostics('call.secure-endpoint', {
      operations: {
        'call.secure-endpoint': {
          method: 'GET',
          url: 'https://api.example.com/users/{{user_id}}/tenant/{{tenant_id}}',
          claimMap: { user_id: 'sub' },
          auth: { type: 'oidc' },
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.configured).toBe(true);
      expect(result.data.pathPlaceholders).toEqual(['user_id', 'tenant_id']);
      expect(result.data.claimMap).toEqual({ user_id: 'sub' });
      expect(result.data.authType).toBe('oidc');
    }
  });

  it('returns unconfigured diagnostics when operation is not configured', () => {
    const result = getApiOperationDiagnostics('call.secure-endpoint', {
      operations: {},
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.configured).toBe(false);
      expect(result.data.configurationHint).toContain('Settings');
      expect(result.data.configurationHint).toContain('runtime-config.json');
    }
  });
});
