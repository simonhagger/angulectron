import { createHash, randomBytes, randomUUID } from 'node:crypto';
import http from 'node:http';
import { URL } from 'node:url';
import {
  asFailure,
  asSuccess,
  type AuthSessionSummary,
  type DesktopResult,
} from '@electron-foundation/contracts';
import type { OidcConfig } from './oidc-config';
import type { RefreshTokenStore } from './secure-token-store';

type DiscoveryDocument = {
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint?: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
};

type OidcServiceOptions = {
  config: OidcConfig;
  tokenStore: RefreshTokenStore;
  openExternal: (url: string) => Promise<void>;
  fetchFn?: typeof fetch;
  logger?: (
    level: 'info' | 'warn' | 'error',
    event: string,
    details?: Record<string, unknown>,
  ) => void;
};

type ActiveTokens = {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken?: string;
  idToken?: string;
};

const authTimeoutMs = 180_000;
const refreshLeadTimeMs = 60_000;

const toBase64Url = (value: Buffer): string =>
  value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const createPkcePair = () => {
  const verifier = toBase64Url(randomBytes(64));
  const challenge = toBase64Url(createHash('sha256').update(verifier).digest());

  return { verifier, challenge };
};

const decodeJwtPayload = (
  token: string | undefined,
): Record<string, unknown> | null => {
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json) as Record<string, unknown>;
    return payload;
  } catch {
    return null;
  }
};

const parseScopeList = (scopeValue: string | undefined): string[] =>
  (scopeValue ?? '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const buildSignedOutSummary = (): AuthSessionSummary => ({
  state: 'signed-out',
  scopes: [],
  entitlements: [],
});

const isLoopbackRedirect = (redirectUri: string) => {
  const parsed = new URL(redirectUri);
  const host = parsed.hostname.toLowerCase();
  return (
    parsed.protocol === 'http:' &&
    (host === '127.0.0.1' || host === 'localhost')
  );
};

const withResolvedRedirectPort = (redirectUri: string) => {
  if (redirectUri.includes('{port}')) {
    return redirectUri.replace('{port}', '0');
  }

  if (redirectUri.includes('__PORT__')) {
    return redirectUri.replace('__PORT__', '0');
  }

  return redirectUri;
};

const renderCallbackPage = (ok: boolean, message: string): string => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Authentication</title>
    <style>
      body { font-family: sans-serif; margin: 2rem; }
      .ok { color: #0f62fe; }
      .err { color: #a2191f; }
    </style>
  </head>
  <body>
    <h1 class="${ok ? 'ok' : 'err'}">${ok ? 'Sign-in complete' : 'Sign-in failed'}</h1>
    <p>${message}</p>
    <p>You can close this window and return to the app.</p>
  </body>
</html>`;

export class OidcService {
  private readonly config: OidcConfig;
  private readonly tokenStore: RefreshTokenStore;
  private readonly openExternal: (url: string) => Promise<void>;
  private readonly fetchFn: typeof fetch;
  private readonly logger?: OidcServiceOptions['logger'];
  private discoveryCache: DiscoveryDocument | null = null;
  private summary: AuthSessionSummary = buildSignedOutSummary();
  private tokens: ActiveTokens | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private signInInFlight = false;

  constructor(options: OidcServiceOptions) {
    this.config = options.config;
    this.tokenStore = options.tokenStore;
    this.openExternal = options.openExternal;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger;
  }

  dispose() {
    this.clearRefreshTimer();
  }

  async signIn(): Promise<DesktopResult<{ initiated: boolean }>> {
    if (this.signInInFlight) {
      return asFailure(
        'AUTH/SIGNIN_IN_PROGRESS',
        'A sign-in flow is already in progress.',
        undefined,
        false,
      );
    }

    this.signInInFlight = true;
    this.summary = {
      state: 'signing-in',
      scopes: this.summary.scopes ?? [],
      entitlements: this.summary.entitlements ?? [],
    };

    try {
      if (!isLoopbackRedirect(this.config.redirectUri)) {
        return asFailure(
          'AUTH/UNSUPPORTED_REDIRECT_URI',
          'Only loopback redirect URIs are currently supported.',
          { redirectUri: this.config.redirectUri },
          false,
        );
      }

      const discovery = await this.getDiscovery();
      const { verifier, challenge } = createPkcePair();
      const state = randomUUID();
      const nonce = randomUUID();
      const callbackResult = await this.waitForAuthorizationCode(
        this.config.redirectUri,
        state,
      );

      const redirectUriForRequest = callbackResult.redirectUri;
      const authorizationUrl = new URL(discovery.authorization_endpoint);
      authorizationUrl.searchParams.set('response_type', 'code');
      authorizationUrl.searchParams.set('client_id', this.config.clientId);
      authorizationUrl.searchParams.set('redirect_uri', redirectUriForRequest);
      authorizationUrl.searchParams.set('scope', this.config.scopes.join(' '));
      authorizationUrl.searchParams.set('state', state);
      authorizationUrl.searchParams.set('nonce', nonce);
      authorizationUrl.searchParams.set('code_challenge', challenge);
      authorizationUrl.searchParams.set('code_challenge_method', 'S256');
      if (this.config.audience) {
        authorizationUrl.searchParams.set('audience', this.config.audience);
      }

      await this.openExternal(authorizationUrl.toString());
      const code = await callbackResult.waitForCode();

      const tokenResult = await this.exchangeCodeForTokens({
        code,
        codeVerifier: verifier,
        redirectUri: redirectUriForRequest,
      });
      if (!tokenResult.ok) {
        const failure = tokenResult as Extract<
          typeof tokenResult,
          { ok: false }
        >;
        this.summary = {
          state: 'signed-out',
          scopes: [],
          entitlements: [],
        };
        return asFailure(
          failure.error.code,
          failure.error.message,
          failure.error.details,
          failure.error.retryable,
          failure.error.correlationId,
        );
      }

      this.applyTokenResponse(tokenResult.data);
      this.logger?.('info', 'auth.signin.success', {
        tokenStore: this.tokenStore.kind,
      });
      return asSuccess({ initiated: true });
    } catch (error) {
      this.summary = buildSignedOutSummary();
      this.logger?.('error', 'auth.signin.failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      return asFailure(
        'AUTH/SIGNIN_FAILED',
        'Authentication sign-in failed.',
        error instanceof Error
          ? { name: error.name, message: error.message }
          : String(error),
        true,
      );
    } finally {
      this.signInInFlight = false;
    }
  }

  async signOut(): Promise<DesktopResult<{ signedOut: boolean }>> {
    this.clearRefreshTimer();
    this.tokens = null;
    this.summary = buildSignedOutSummary();

    try {
      await this.tokenStore.clear();
      return asSuccess({ signedOut: true });
    } catch (error) {
      return asFailure(
        'AUTH/SIGNOUT_FAILED',
        'Failed to clear authentication state.',
        error instanceof Error
          ? { name: error.name, message: error.message }
          : String(error),
        false,
      );
    }
  }

  async getSessionSummary(): Promise<DesktopResult<AuthSessionSummary>> {
    if (this.tokens && Date.now() >= this.tokens.accessTokenExpiresAt) {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed.ok) {
        return refreshed;
      }
    }

    if (!this.tokens) {
      return asSuccess(this.summary);
    }

    return asSuccess(this.summary);
  }

  getAccessToken(): string | null {
    if (!this.tokens) {
      return null;
    }

    if (Date.now() >= this.tokens.accessTokenExpiresAt) {
      return null;
    }

    return this.tokens.accessToken;
  }

  private clearRefreshTimer() {
    if (!this.refreshTimer) {
      return;
    }
    clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private scheduleRefresh() {
    this.clearRefreshTimer();
    if (!this.tokens?.refreshToken) {
      return;
    }

    const msUntilRefresh = Math.max(
      5_000,
      this.tokens.accessTokenExpiresAt - Date.now() - refreshLeadTimeMs,
    );

    this.refreshTimer = setTimeout(() => {
      void this.refreshAccessToken();
    }, msUntilRefresh);
  }

  private async getDiscovery(): Promise<DiscoveryDocument> {
    if (this.discoveryCache) {
      return this.discoveryCache;
    }

    const response = await this.fetchFn(
      `${this.config.issuer}/.well-known/openid-configuration`,
      {
        method: 'GET',
      },
    );

    if (!response.ok) {
      throw new Error(`OIDC discovery failed (${response.status}).`);
    }

    const payload = (await response.json()) as Partial<DiscoveryDocument>;
    if (!payload.authorization_endpoint || !payload.token_endpoint) {
      throw new Error('OIDC discovery payload is missing required endpoints.');
    }

    this.discoveryCache = {
      authorization_endpoint: payload.authorization_endpoint,
      token_endpoint: payload.token_endpoint,
      revocation_endpoint: payload.revocation_endpoint,
    };
    return this.discoveryCache;
  }

  private async exchangeCodeForTokens(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<DesktopResult<TokenResponse>> {
    const discovery = await this.getDiscovery();
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('client_id', this.config.clientId);
    body.set('code', input.code);
    body.set('redirect_uri', input.redirectUri);
    body.set('code_verifier', input.codeVerifier);

    if (this.config.audience) {
      body.set('audience', this.config.audience);
    }

    const response = await this.fetchFn(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const detail = await response.text();
      return asFailure(
        'AUTH/TOKEN_EXCHANGE_FAILED',
        'OIDC token exchange failed.',
        { status: response.status, detail },
        true,
      );
    }

    const payload = (await response.json()) as Partial<TokenResponse>;
    if (!payload.access_token || !payload.token_type) {
      return asFailure(
        'AUTH/TOKEN_PAYLOAD_INVALID',
        'OIDC token response is missing required fields.',
        payload,
        false,
      );
    }

    return asSuccess({
      access_token: payload.access_token,
      token_type: payload.token_type,
      expires_in: payload.expires_in,
      refresh_token: payload.refresh_token,
      id_token: payload.id_token,
      scope: payload.scope,
    });
  }

  private async refreshAccessToken(): Promise<
    DesktopResult<AuthSessionSummary>
  > {
    const discovery = await this.getDiscovery();
    const refreshToken =
      this.tokens?.refreshToken ?? (await this.tokenStore.get());

    if (!refreshToken) {
      this.summary = buildSignedOutSummary();
      this.tokens = null;
      return asSuccess(this.summary);
    }

    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('client_id', this.config.clientId);
    body.set('refresh_token', refreshToken);
    if (this.config.audience) {
      body.set('audience', this.config.audience);
    }

    const response = await this.fetchFn(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      await this.signOut();
      this.summary = {
        state: 'refresh-failed',
        scopes: [],
        entitlements: [],
      };
      return asFailure(
        'AUTH/REFRESH_FAILED',
        'Session refresh failed. Please sign in again.',
        { status: response.status },
        false,
      );
    }

    const payload = (await response.json()) as Partial<TokenResponse>;
    if (!payload.access_token || !payload.token_type) {
      await this.signOut();
      return asFailure(
        'AUTH/TOKEN_PAYLOAD_INVALID',
        'Refresh response is missing required token fields.',
        payload,
        false,
      );
    }

    this.applyTokenResponse({
      access_token: payload.access_token,
      token_type: payload.token_type,
      expires_in: payload.expires_in,
      refresh_token: payload.refresh_token ?? refreshToken,
      id_token: payload.id_token ?? this.tokens?.idToken,
      scope: payload.scope,
    });

    return asSuccess(this.summary);
  }

  private applyTokenResponse(tokenResponse: TokenResponse) {
    const expiresInSeconds =
      typeof tokenResponse.expires_in === 'number' &&
      Number.isFinite(tokenResponse.expires_in)
        ? Math.max(60, Math.floor(tokenResponse.expires_in))
        : 300;
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const refreshToken = tokenResponse.refresh_token;
    const idClaims = decodeJwtPayload(tokenResponse.id_token);
    const scopes =
      parseScopeList(tokenResponse.scope) ||
      this.config.scopes.filter((scope) => scope.length > 0);
    const entitlements =
      Array.isArray(idClaims?.roles) &&
      idClaims.roles.every((value) => typeof value === 'string')
        ? (idClaims.roles as string[])
        : [];

    this.tokens = {
      accessToken: tokenResponse.access_token,
      accessTokenExpiresAt: expiresAt,
      refreshToken,
      idToken: tokenResponse.id_token,
    };

    this.summary = {
      state: 'active',
      userId:
        typeof idClaims?.sub === 'string'
          ? (idClaims.sub as string)
          : undefined,
      email:
        typeof idClaims?.email === 'string'
          ? (idClaims.email as string)
          : undefined,
      name:
        typeof idClaims?.name === 'string'
          ? (idClaims.name as string)
          : undefined,
      expiresAt: new Date(expiresAt).toISOString(),
      scopes:
        scopes.length > 0
          ? scopes
          : this.config.scopes.filter((scope) => scope.length > 0),
      entitlements,
    };

    if (refreshToken) {
      void this.tokenStore.set(refreshToken);
    }

    this.scheduleRefresh();
  }

  private async waitForAuthorizationCode(
    redirectUriTemplate: string,
    expectedState: string,
  ): Promise<{ redirectUri: string; waitForCode: () => Promise<string> }> {
    const redirectUri = withResolvedRedirectPort(redirectUriTemplate);
    const parsed = new URL(redirectUri);

    if (parsed.protocol !== 'http:') {
      throw new Error('OIDC redirect URI must use loopback HTTP.');
    }

    const pathname = parsed.pathname;
    const hostname = parsed.hostname;
    const timeoutAt = Date.now() + authTimeoutMs;

    let settle: ((value: string | PromiseLike<string>) => void) | null = null;
    let rejectSettle: ((reason?: unknown) => void) | null = null;
    const codePromise = new Promise<string>((resolve, reject) => {
      settle = resolve;
      rejectSettle = reject;
    });

    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);
      if (requestUrl.pathname !== pathname) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      const state = requestUrl.searchParams.get('state');
      const code = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');

      if (state !== expectedState) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(renderCallbackPage(false, 'State mismatch.'));
        rejectSettle?.(new Error('OIDC callback state mismatch.'));
        return;
      }

      if (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(renderCallbackPage(false, `Authorization failed: ${error}`));
        rejectSettle?.(
          new Error(`OIDC provider returned an authorization error: ${error}`),
        );
        return;
      }

      if (!code) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(renderCallbackPage(false, 'Missing authorization code.'));
        rejectSettle?.(new Error('OIDC callback missing authorization code.'));
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(
        renderCallbackPage(true, 'Authentication finished successfully.'),
      );
      settle?.(code);
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(Number(parsed.port || 0), hostname, () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('OIDC callback server failed to bind.');
    }

    const effectiveRedirectUri = new URL(redirectUriTemplate);
    effectiveRedirectUri.protocol = 'http:';
    effectiveRedirectUri.hostname = hostname;
    effectiveRedirectUri.port = String(address.port);

    const timeoutHandle = setInterval(() => {
      if (Date.now() >= timeoutAt) {
        clearInterval(timeoutHandle);
        rejectSettle?.(new Error('OIDC sign-in timed out.'));
      }
    }, 200);

    return {
      redirectUri: effectiveRedirectUri.toString(),
      waitForCode: async () => {
        try {
          return await codePromise;
        } finally {
          clearInterval(timeoutHandle);
          server.close();
        }
      },
    };
  }
}
