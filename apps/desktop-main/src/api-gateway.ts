import {
  asFailure,
  asSuccess,
  type ApiOperationId,
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

const SAFE_HEADER_NAME_PATTERN = /^x-[a-z0-9-]+$/i;
const JWT_CLAIM_PATH_PATTERN = /^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*$/;

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

const operationConfigurationIssues: Partial<Record<ApiOperationId, string>> = {
  'call.secure-endpoint':
    'Set API secure endpoint configuration in Settings or runtime-config.json to enable this operation.',
};

const resolveDefaultApiOperations = (): Partial<
  Record<ApiOperationId, ApiOperation>
> => {
  const configuredSecureEndpointUrl = resolveConfiguredSecureEndpointUrl();
  const configuredSecureEndpointClaimMap =
    resolveConfiguredSecureEndpointClaimMap();

  return {
    'status.github': {
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

export let defaultApiOperations: Partial<Record<ApiOperationId, ApiOperation>> =
  resolveDefaultApiOperations();

export const refreshDefaultApiOperationsFromEnv = () => {
  defaultApiOperations = resolveDefaultApiOperations();
};

type InvokeApiDeps = {
  fetchFn?: typeof fetch;
  operations?: Partial<Record<ApiOperationId, ApiOperation>>;
};

type GetApiOperationDiagnosticsDeps = {
  operations?: Partial<Record<ApiOperationId, ApiOperation>>;
};

type ApiSuccess = {
  status: number;
  data: unknown;
  contentType?: string;
  requestPath?: string;
};

type ApiOperationDiagnostics = {
  operationId: ApiOperationId;
  configured: boolean;
  configurationHint?: string;
  method?: 'GET' | 'POST';
  urlTemplate?: string;
  pathPlaceholders: string[];
  claimMap: Record<string, string>;
  authType?: 'none' | 'bearer' | 'oidc';
};

type OperationRuntimeState = {
  inFlight: number;
  lastStartedAt: number;
};

const operationRuntimeState = new Map<string, OperationRuntimeState>();
let oidcAccessTokenResolver: (() => string | null) | null = null;

export const setOidcAccessTokenResolver = (
  resolver: (() => string | null) | null,
) => {
  oidcAccessTokenResolver = resolver;
};

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

const PATH_PARAM_PATTERN = /\{\{([a-zA-Z0-9_]+)\}\}/g;
const ERROR_DETAIL_PREVIEW_MAX_CHARS = 512;

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const readJwtClaimByPath = (
  payload: Record<string, unknown> | null,
  path: string,
): string | number | boolean | null | undefined => {
  if (!payload || !path || !JWT_CLAIM_PATH_PATTERN.test(path)) {
    return undefined;
  }

  const segments = path.split('.');
  let current: unknown = payload;

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  if (
    typeof current === 'string' ||
    typeof current === 'number' ||
    typeof current === 'boolean' ||
    current === null
  ) {
    return current as string | number | boolean | null;
  }

  return undefined;
};

const pickTokenDebugClaims = (payload: Record<string, unknown> | null) => {
  if (!payload) {
    return null;
  }

  return {
    iss: typeof payload.iss === 'string' ? payload.iss : undefined,
    sub: typeof payload.sub === 'string' ? payload.sub : undefined,
    aud: Array.isArray(payload.aud)
      ? payload.aud.filter((value) => typeof value === 'string')
      : typeof payload.aud === 'string'
        ? payload.aud
        : undefined,
    azp: typeof payload.azp === 'string' ? payload.azp : undefined,
    scope: typeof payload.scope === 'string' ? payload.scope : undefined,
    exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    token_use:
      typeof payload.token_use === 'string' ? payload.token_use : undefined,
  };
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
  const providedParams = request.payload.params ?? {};

  const auth = operation.auth ?? { type: 'none' as const };
  let oidcPayload: Record<string, unknown> | null = null;
  let oidcTokenClaims: ReturnType<typeof pickTokenDebugClaims> | undefined;

  const headers = new Headers();
  headers.set('Accept', 'application/json');

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

  if (auth.type === 'oidc') {
    const token = oidcAccessTokenResolver?.();
    if (!token) {
      return asFailure(
        'API/AUTH_REQUIRED',
        'An active OIDC session is required for this API operation.',
        {
          operationId: request.payload.operationId,
        },
        false,
        correlationId,
      );
    }

    headers.set('Authorization', `Bearer ${token}`);
    oidcPayload = decodeJwtPayload(token);
    oidcTokenClaims = pickTokenDebugClaims(oidcPayload);
  }

  if (request.payload.headers) {
    for (const [key, value] of Object.entries(request.payload.headers)) {
      if (!SAFE_HEADER_NAME_PATTERN.test(key)) {
        return asFailure(
          'API/INVALID_HEADERS',
          'Request headers contain unsupported header names.',
          {
            operationId: request.payload.operationId,
            header: key,
          },
          false,
          correlationId,
        );
      }

      headers.set(key, value);
    }
  }

  const usedPathParams = new Set<string>();
  const missingPathParams: string[] = [];
  const templatedUrl = operation.url.replace(
    PATH_PARAM_PATTERN,
    (_match, rawParamName: string) => {
      const paramName = String(rawParamName);
      const directValue = providedParams[paramName];
      if (
        typeof directValue === 'string' ||
        typeof directValue === 'number' ||
        typeof directValue === 'boolean'
      ) {
        usedPathParams.add(paramName);
        return encodeURIComponent(String(directValue));
      }

      const mappedClaimPath = operation.claimMap?.[paramName];
      const claimValue = mappedClaimPath
        ? readJwtClaimByPath(oidcPayload, mappedClaimPath)
        : undefined;
      if (
        typeof claimValue === 'string' ||
        typeof claimValue === 'number' ||
        typeof claimValue === 'boolean'
      ) {
        usedPathParams.add(paramName);
        return encodeURIComponent(String(claimValue));
      }

      missingPathParams.push(paramName);
      return '';
    },
  );

  if (missingPathParams.length > 0) {
    return asFailure(
      'API/INVALID_PARAMS',
      'Required path parameters are missing for API operation.',
      {
        operationId: request.payload.operationId,
        missingPathParams,
        claimMap: operation.claimMap ?? {},
      },
      false,
      correlationId,
    );
  }

  let requestUrl: URL;
  try {
    requestUrl = new URL(templatedUrl);
  } catch (error) {
    return asFailure(
      'API/OPERATION_CONFIG_INVALID',
      'API operation configuration is invalid.',
      error,
      false,
      correlationId,
    );
  }

  if (operation.method === 'GET' && request.payload.params) {
    for (const [key, value] of Object.entries(request.payload.params)) {
      if (usedPathParams.has(key)) {
        continue;
      }
      requestUrl.searchParams.set(key, String(value));
    }
  }

  const requestUrlString = requestUrl.toString();

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
      return asFailure(
        'API/REDIRECT_BLOCKED',
        'External API redirects are blocked by policy.',
        {
          operationId: request.payload.operationId,
          location: location ?? null,
        },
        false,
        correlationId,
      );
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

    if (!response.ok) {
      const detailPreview =
        responseText.length > ERROR_DETAIL_PREVIEW_MAX_CHARS
          ? `${responseText.slice(0, ERROR_DETAIL_PREVIEW_MAX_CHARS)}...`
          : responseText;
      const failureDetails = {
        operationId: request.payload.operationId,
        requestUrl: requestUrlString,
        status: response.status,
        contentType,
        hasAuthorizationHeader: headers.has('Authorization'),
        tokenClaims: oidcTokenClaims,
        detail:
          detailPreview.length > 0
            ? detailPreview
            : 'No response body provided.',
      };

      if (response.status === 401) {
        return asFailure(
          'API/AUTH_REQUIRED',
          'External API requires authentication.',
          failureDetails,
          false,
          correlationId,
        );
      }

      if (response.status === 403) {
        return asFailure(
          'API/FORBIDDEN',
          'External API request is forbidden by policy or credentials.',
          failureDetails,
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
          failureDetails,
          true,
          correlationId,
        );
      }

      return asFailure(
        'API/CLIENT_ERROR',
        'External API returned a client error response.',
        failureDetails,
        false,
        correlationId,
      );
    }

    const isJsonContentType =
      typeof contentType === 'string' &&
      /^application\/([a-z0-9.+-]+\+)?json/i.test(contentType);
    if (!isJsonContentType) {
      return asFailure(
        'API/UNSUPPORTED_CONTENT_TYPE',
        'External API response content type is not allowed.',
        { operationId: request.payload.operationId, contentType },
        false,
        correlationId,
      );
    }

    let responseData: unknown;
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

    return asSuccess({
      status: response.status,
      data: responseData,
      contentType,
      requestPath: `${requestUrl.pathname}${requestUrl.search}`,
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

const extractPathPlaceholders = (urlTemplate: string): string[] => {
  const matches = urlTemplate.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g);
  const values = new Set<string>();
  for (const match of matches) {
    if (match[1]) {
      values.add(match[1]);
    }
  }
  return Array.from(values.values());
};

export const getApiOperationDiagnostics = (
  operationId: ApiOperationId,
  deps: GetApiOperationDiagnosticsDeps = {},
): DesktopResult<ApiOperationDiagnostics> => {
  const operations = deps.operations ?? defaultApiOperations;
  const operation = operations[operationId];

  if (!operation) {
    const configurationHint = operationConfigurationIssues[operationId];
    return asSuccess({
      operationId,
      configured: false,
      configurationHint,
      pathPlaceholders: [],
      claimMap: {},
    });
  }

  return asSuccess({
    operationId,
    configured: true,
    method: operation.method,
    urlTemplate: operation.url,
    pathPlaceholders: extractPathPlaceholders(operation.url),
    claimMap: operation.claimMap ?? {},
    authType: operation.auth?.type ?? 'none',
  });
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
    const configIssue =
      operationConfigurationIssues[request.payload.operationId];
    if (configIssue) {
      return asFailure(
        'API/OPERATION_NOT_CONFIGURED',
        'Requested API operation is not configured in this environment.',
        {
          operationId: request.payload.operationId,
          configurationHint: configIssue,
        },
        false,
        correlationId,
      );
    }

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
