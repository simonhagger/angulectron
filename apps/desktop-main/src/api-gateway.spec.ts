import { describe, expect, it } from 'vitest';
import type {
  ApiInvokeRequest,
  DesktopResult,
} from '@electron-foundation/contracts';
import { invokeApiOperation, type ApiOperation } from './api-gateway';

const baseRequest = (
  operationId: string,
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
    const result = await invokeApiOperation(baseRequest('unknown.op'), {
      operations: {},
    });

    const error = expectFailure(result);
    expect(error.code).toBe('API/OPERATION_NOT_ALLOWED');
    expect(error.correlationId).toBe('corr-test');
  });

  it('rejects insecure destinations', async () => {
    const operations: Record<string, ApiOperation> = {
      insecure: { method: 'GET', url: 'http://example.com' },
    };
    const result = await invokeApiOperation(baseRequest('insecure'), {
      operations,
    });

    const error = expectFailure(result);
    expect(error.code).toBe('API/INSECURE_DESTINATION');
  });

  it('blocks redirects to other hosts', async () => {
    const operations: Record<string, ApiOperation> = {
      test: { method: 'GET', url: 'https://api.example.com/data' },
    };
    const fetchFn: typeof fetch = async () =>
      new Response('', {
        status: 302,
        headers: {
          location: 'https://evil.example.net/pwn',
        },
      });

    const result = await invokeApiOperation(baseRequest('test'), {
      operations,
      fetchFn,
    });

    const error = expectFailure(result);
    expect(error.code).toBe('API/REDIRECT_BLOCKED');
  });

  it('returns timeout for aborted requests', async () => {
    const operations: Record<string, ApiOperation> = {
      test: {
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

    const result = await invokeApiOperation(baseRequest('test'), {
      operations,
      fetchFn,
    });

    const error = expectFailure(result);
    expect(error.code).toBe('API/TIMEOUT');
  });

  it('returns parsed json data for successful responses', async () => {
    const operations: Record<string, ApiOperation> = {
      test: { method: 'GET', url: 'https://api.example.com/ok' },
    };
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ hello: 'world' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });

    const result = await invokeApiOperation(baseRequest('test'), {
      operations,
      fetchFn,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe(200);
      expect(result.data.data).toEqual({ hello: 'world' });
    }
  });
});
