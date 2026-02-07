import {
  asFailure,
  asSuccess,
  type ApiInvokeRequest,
  type DesktopResult,
} from '@electron-foundation/contracts';

const API_DEFAULT_TIMEOUT_MS = 8_000;
const API_DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;

export type ApiOperation = {
  method: 'GET' | 'POST';
  url: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
};

export const defaultApiOperations: Record<string, ApiOperation> = {
  'status.github': {
    method: 'GET',
    url: 'https://api.github.com/rate_limit',
    timeoutMs: 8_000,
    maxResponseBytes: 256_000,
  },
};

type InvokeApiDeps = {
  fetchFn?: typeof fetch;
  operations?: Record<string, ApiOperation>;
};

export const invokeApiOperation = async (
  request: ApiInvokeRequest,
  deps: InvokeApiDeps = {},
): Promise<
  DesktopResult<{
    status: number;
    data: unknown;
    contentType?: string;
  }>
> => {
  const operations = deps.operations ?? defaultApiOperations;
  const fetchFn = deps.fetchFn ?? fetch;
  const correlationId = request.correlationId;

  const operation = operations[request.payload.operationId];
  if (!operation) {
    return asFailure(
      'API/OPERATION_NOT_ALLOWED',
      'Requested API operation is not allowed.',
      { operationId: request.payload.operationId },
      false,
      correlationId,
    );
  }

  let operationUrl: URL;
  try {
    operationUrl = new URL(operation.url);
  } catch (error) {
    return asFailure(
      'API/OPERATION_CONFIG_INVALID',
      'API operation configuration is invalid.',
      error,
      false,
      correlationId,
    );
  }

  if (operationUrl.protocol !== 'https:') {
    return asFailure(
      'API/INSECURE_DESTINATION',
      'API operation destination must use HTTPS.',
      { operationId: request.payload.operationId, url: operation.url },
      false,
      correlationId,
    );
  }

  const timeoutMs = operation.timeoutMs ?? API_DEFAULT_TIMEOUT_MS;
  const maxResponseBytes =
    operation.maxResponseBytes ?? API_DEFAULT_MAX_RESPONSE_BYTES;
  const requestUrl = new URL(operationUrl);
  if (operation.method === 'GET' && request.payload.params) {
    for (const [key, value] of Object.entries(request.payload.params)) {
      requestUrl.searchParams.set(key, String(value));
    }
  }

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetchFn(requestUrl, {
      method: operation.method,
      headers: {
        Accept: 'application/json',
      },
      redirect: 'manual',
      signal: abortController.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return asFailure(
          'API/REDIRECT_BLOCKED',
          'External API redirect was blocked.',
          { operationId: request.payload.operationId },
          false,
          correlationId,
        );
      }

      const redirectedUrl = new URL(location, operationUrl);
      if (
        redirectedUrl.protocol !== 'https:' ||
        redirectedUrl.host !== operationUrl.host
      ) {
        return asFailure(
          'API/REDIRECT_BLOCKED',
          'External API redirect destination is not allowed.',
          {
            operationId: request.payload.operationId,
            redirectHost: redirectedUrl.host,
          },
          false,
          correlationId,
        );
      }
    }

    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
        return asFailure(
          'API/PAYLOAD_TOO_LARGE',
          'External API response exceeded allowed size.',
          {
            operationId: request.payload.operationId,
            contentLength,
          },
          false,
          correlationId,
        );
      }
    }

    const responseText = await response.text();
    const responseBytes = Buffer.byteLength(responseText, 'utf8');
    if (responseBytes > maxResponseBytes) {
      return asFailure(
        'API/PAYLOAD_TOO_LARGE',
        'External API response exceeded allowed size.',
        {
          operationId: request.payload.operationId,
          responseBytes,
        },
        false,
        correlationId,
      );
    }

    const contentType = response.headers.get('content-type') ?? undefined;
    let responseData: unknown = responseText;
    if (contentType && contentType.includes('application/json')) {
      try {
        responseData = JSON.parse(responseText);
      } catch (error) {
        return asFailure(
          'API/RESPONSE_PARSE_FAILED',
          'External API returned invalid JSON.',
          {
            operationId: request.payload.operationId,
            error:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : String(error),
          },
          false,
          correlationId,
        );
      }
    }

    if (!response.ok) {
      return asFailure(
        'API/HTTP_ERROR',
        'External API returned an error response.',
        {
          operationId: request.payload.operationId,
          status: response.status,
          bodyPreview: responseText.slice(0, 200),
        },
        response.status >= 500,
        correlationId,
      );
    }

    return asSuccess({
      status: response.status,
      data: responseData,
      contentType,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return asFailure(
        'API/TIMEOUT',
        'External API request timed out.',
        { operationId: request.payload.operationId, timeoutMs },
        true,
        correlationId,
      );
    }

    return asFailure(
      'API/NETWORK_ERROR',
      'External API request failed.',
      {
        operationId: request.payload.operationId,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : String(error),
      },
      true,
      correlationId,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
};
