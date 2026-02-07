import {
  asFailure,
  asSuccess,
  type ApiInvokeRequest,
  type DesktopResult,
} from '@electron-foundation/contracts';

const API_DEFAULT_TIMEOUT_MS = 8_000;
const API_DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;
const API_DEFAULT_CONCURRENCY_LIMIT = 4;
const API_DEFAULT_RETRY_ATTEMPTS = 2;
const API_DEFAULT_RETRY_BASE_DELAY_MS = 200;

export type ApiOperation = {
  method: 'GET' | 'POST';
  url: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  concurrencyLimit?: number;
  minIntervalMs?: number;
  auth?:
    | {
        type: 'bearer';
        tokenEnvVar: string;
      }
    | {
        type: 'none';
      };
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
  };
};

export const defaultApiOperations: Record<string, ApiOperation> = {
  'status.github': {
    method: 'GET',
    url: 'https://api.github.com/rate_limit',
    timeoutMs: 8_000,
    maxResponseBytes: 256_000,
    concurrencyLimit: 2,
    minIntervalMs: 300,
    auth: { type: 'none' },
  },
};

type InvokeApiDeps = {
  fetchFn?: typeof fetch;
  operations?: Record<string, ApiOperation>;
};

type ApiSuccess = {
  status: number;
  data: unknown;
  contentType?: string;
};

type OperationRuntimeState = {
  inFlight: number;
  lastStartedAt: number;
};

const operationRuntimeState = new Map<string, OperationRuntimeState>();

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const classifyTransportError = (
  operationId: string,
  correlationId: string,
  error: unknown,
): DesktopResult<never> => {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error ?? 'Unknown network error');
  const lowered = message.toLowerCase();

  if (
    lowered.includes('enotfound') ||
    lowered.includes('eai_again') ||
    lowered.includes('dns')
  ) {
    return asFailure(
      'API/DNS_ERROR',
      'External API request failed due to DNS resolution issues.',
      { operationId, message },
      true,
      correlationId,
    );
  }

  if (
    lowered.includes('enetunreach') ||
    lowered.includes('network is unreachable') ||
    lowered.includes('offline') ||
    lowered.includes('failed to fetch')
  ) {
    return asFailure(
      'API/OFFLINE',
      'External API request failed because the system appears offline.',
      { operationId, message },
      true,
      correlationId,
    );
  }

  if (lowered.includes('proxy') || lowered.includes('tunnel')) {
    return asFailure(
      'API/PROXY_ERROR',
      'External API request failed due to proxy/network policy.',
      { operationId, message },
      true,
      correlationId,
    );
  }

  if (
    lowered.includes('certificate') ||
    lowered.includes('cert_') ||
    lowered.includes('tls') ||
    lowered.includes('self signed')
  ) {
    return asFailure(
      'API/TLS_ERROR',
      'External API request failed due to TLS/certificate validation.',
      { operationId, message },
      false,
      correlationId,
    );
  }

  return asFailure(
    'API/NETWORK_ERROR',
    'External API request failed.',
    { operationId, message },
    true,
    correlationId,
  );
};

const isRetryableFailure = (code: string) =>
  [
    'API/TIMEOUT',
    'API/NETWORK_ERROR',
    'API/OFFLINE',
    'API/DNS_ERROR',
    'API/PROXY_ERROR',
    'API/SERVER_ERROR',
    'API/RATE_LIMITED',
  ].includes(code);

const invokeSingleAttempt = async (
  request: ApiInvokeRequest,
  operation: ApiOperation,
  fetchFn: typeof fetch,
): Promise<DesktopResult<ApiSuccess>> => {
  const correlationId = request.correlationId;
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

  const headers = new Headers();
  headers.set('Accept', 'application/json');

  const auth = operation.auth ?? { type: 'none' as const };
  if (auth.type === 'bearer') {
    const token = process.env[auth.tokenEnvVar]?.trim();
    if (!token) {
      return asFailure(
        'API/CREDENTIALS_UNAVAILABLE',
        'Required API credentials are not available.',
        {
          operationId: request.payload.operationId,
          tokenEnvVar: auth.tokenEnvVar,
        },
        false,
        correlationId,
      );
    }

    headers.set('Authorization', `Bearer ${token}`);
  }

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetchFn(requestUrl, {
      method: operation.method,
      headers,
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
      if (response.status === 401) {
        return asFailure(
          'API/AUTH_REQUIRED',
          'External API requires authentication.',
          { operationId: request.payload.operationId, status: response.status },
          false,
          correlationId,
        );
      }

      if (response.status === 403) {
        return asFailure(
          'API/FORBIDDEN',
          'External API request is forbidden by policy or credentials.',
          { operationId: request.payload.operationId, status: response.status },
          false,
          correlationId,
        );
      }

      if (response.status === 429) {
        return asFailure(
          'API/RATE_LIMITED',
          'External API rate limit was exceeded.',
          { operationId: request.payload.operationId, status: response.status },
          true,
          correlationId,
        );
      }

      if (response.status >= 500) {
        return asFailure(
          'API/SERVER_ERROR',
          'External API returned a server error response.',
          { operationId: request.payload.operationId, status: response.status },
          true,
          correlationId,
        );
      }

      return asFailure(
        'API/CLIENT_ERROR',
        'External API returned a client error response.',
        { operationId: request.payload.operationId, status: response.status },
        false,
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

    return classifyTransportError(
      request.payload.operationId,
      correlationId,
      error,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const getOperationState = (operationId: string): OperationRuntimeState => {
  const existing = operationRuntimeState.get(operationId);
  if (existing) {
    return existing;
  }

  const initial = { inFlight: 0, lastStartedAt: 0 };
  operationRuntimeState.set(operationId, initial);
  return initial;
};

export const invokeApiOperation = async (
  request: ApiInvokeRequest,
  deps: InvokeApiDeps = {},
): Promise<DesktopResult<ApiSuccess>> => {
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

  const state = getOperationState(request.payload.operationId);
  const concurrencyLimit =
    operation.concurrencyLimit ?? API_DEFAULT_CONCURRENCY_LIMIT;

  if (state.inFlight >= concurrencyLimit) {
    return asFailure(
      'API/THROTTLED',
      'Too many concurrent API requests for this operation.',
      { operationId: request.payload.operationId, concurrencyLimit },
      true,
      correlationId,
    );
  }

  const minIntervalMs = operation.minIntervalMs ?? 0;
  const elapsedSinceLast = Date.now() - state.lastStartedAt;
  if (minIntervalMs > 0 && elapsedSinceLast < minIntervalMs) {
    return asFailure(
      'API/RATE_LIMITED',
      'API operation is temporarily rate-limited.',
      {
        operationId: request.payload.operationId,
        retryAfterMs: minIntervalMs - elapsedSinceLast,
      },
      true,
      correlationId,
    );
  }

  state.inFlight += 1;
  state.lastStartedAt = Date.now();

  try {
    const retryAttempts =
      operation.method === 'GET'
        ? Math.max(
            1,
            operation.retry?.maxAttempts ?? API_DEFAULT_RETRY_ATTEMPTS,
          )
        : 1;

    const retryBaseDelayMs =
      operation.retry?.baseDelayMs ?? API_DEFAULT_RETRY_BASE_DELAY_MS;

    for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
      const result = await invokeSingleAttempt(request, operation, fetchFn);
      if (!result.ok) {
        const failure = result as Extract<typeof result, { ok: false }>;
        const errorCode = failure.error.code;
        if (attempt >= retryAttempts || !isRetryableFailure(errorCode)) {
          return failure;
        }

        const jitterMs = Math.floor(Math.random() * 50);
        await sleep(retryBaseDelayMs * attempt + jitterMs);
        continue;
      }
      return result;
    }

    return asFailure(
      'API/UNKNOWN_FAILURE',
      'External API operation failed.',
      { operationId: request.payload.operationId },
      false,
      correlationId,
    );
  } finally {
    const latest = getOperationState(request.payload.operationId);
    latest.inFlight = Math.max(0, latest.inFlight - 1);
  }
};
