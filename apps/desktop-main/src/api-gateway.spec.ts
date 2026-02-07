import { describe, expect, it } from 'vitest';
import type {
  ApiInvokeRequest,
  ApiOperationId,
  DesktopResult,
} from '@electron-foundation/contracts';
import { invokeApiOperation, type ApiOperation } from './api-gateway';

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
