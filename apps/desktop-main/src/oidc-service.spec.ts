import { describe, expect, it, vi } from 'vitest';
import type { OidcConfig } from './oidc-config';
import { OidcService } from './oidc-service';
import type { RefreshTokenStore } from './secure-token-store';

const toBase64Url = (value: string): string =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const createJwt = (payload: Record<string, unknown>): string => {
  const header = toBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  return `${header}.${body}.sig`;
};

const baseConfig: OidcConfig = {
  issuer: 'https://issuer.example.com',
  clientId: 'desktop-client',
  redirectUri: 'http://127.0.0.1:42813/callback',
  scopes: ['openid', 'profile', 'email'],
  audience: 'api://desktop',
  sendAudienceInAuthorize: false,
  apiBearerTokenSource: 'access_token',
};

const createStore = (
  overrides?: Partial<RefreshTokenStore>,
): RefreshTokenStore => ({
  kind: 'file-encrypted',
  get: async () => null,
  set: async () => undefined,
  clear: async () => undefined,
  ...overrides,
});

describe('OidcService lifecycle', () => {
  it('calls revocation endpoint and clears token store on global sign out', async () => {
    const store = createStore({
      get: vi.fn(async () => 'stored-refresh-token'),
      clear: vi.fn(async () => undefined),
    });

    const fetchFn: typeof fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/.well-known/openid-configuration')) {
        return new Response(
          JSON.stringify({
            authorization_endpoint: 'https://issuer.example.com/authorize',
            token_endpoint: 'https://issuer.example.com/oauth/token',
            revocation_endpoint: 'https://issuer.example.com/oauth/revoke',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url === 'https://issuer.example.com/oauth/revoke') {
        const body = String(init?.body ?? '');
        expect(body).toContain('token=stored-refresh-token');
        expect(body).toContain('token_type_hint=refresh_token');
        return new Response('', { status: 200 });
      }

      return new Response('unexpected', { status: 500 });
    });

    const service = new OidcService({
      config: baseConfig,
      tokenStore: store,
      openExternal: async () => undefined,
      fetchFn,
    });

    const result = await service.signOut('global');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mode).toBe('global');
      expect(result.data.refreshTokenRevoked).toBe(true);
      expect(result.data.providerLogoutSupported).toBe(true);
    }
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://issuer.example.com/oauth/revoke',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('still clears local token store when revocation fails', async () => {
    const store = createStore({
      get: vi.fn(async () => 'stored-refresh-token'),
      clear: vi.fn(async () => undefined),
    });

    const fetchFn: typeof fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.endsWith('/.well-known/openid-configuration')) {
        return new Response(
          JSON.stringify({
            authorization_endpoint: 'https://issuer.example.com/authorize',
            token_endpoint: 'https://issuer.example.com/oauth/token',
            revocation_endpoint: 'https://issuer.example.com/oauth/revoke',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url === 'https://issuer.example.com/oauth/revoke') {
        return new Response('nope', { status: 500 });
      }

      return new Response('unexpected', { status: 500 });
    });

    const service = new OidcService({
      config: baseConfig,
      tokenStore: store,
      openExternal: async () => undefined,
      fetchFn,
    });

    const result = await service.signOut('global');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.refreshTokenRevoked).toBe(false);
      expect(result.data.providerLogoutSupported).toBe(true);
    }
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it('performs local-only sign out without provider calls', async () => {
    const store = createStore({
      get: vi.fn(async () => 'stored-refresh-token'),
      clear: vi.fn(async () => undefined),
    });

    const fetchFn: typeof fetch = vi.fn(async () => {
      return new Response('unexpected', { status: 500 });
    });

    const service = new OidcService({
      config: baseConfig,
      tokenStore: store,
      openExternal: async () => undefined,
      fetchFn,
    });

    const result = await service.signOut('local');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mode).toBe('local');
      expect(result.data.refreshTokenRevoked).toBe(false);
      expect(result.data.providerLogoutSupported).toBe(false);
      expect(result.data.providerLogoutInitiated).toBe(false);
    }
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rehydrates active session from stored refresh token on startup', async () => {
    const store = createStore({
      get: vi.fn(async () => 'stored-refresh-token'),
      set: vi.fn(async () => undefined),
    });

    const idToken = createJwt({
      sub: 'user-123',
      email: 'user@example.com',
      name: 'Example User',
    });

    const fetchFn: typeof fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/.well-known/openid-configuration')) {
        return new Response(
          JSON.stringify({
            authorization_endpoint: 'https://issuer.example.com/authorize',
            token_endpoint: 'https://issuer.example.com/oauth/token',
            revocation_endpoint: 'https://issuer.example.com/oauth/revoke',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url === 'https://issuer.example.com/oauth/token') {
        const body = String(init?.body ?? '');
        expect(body).toContain('grant_type=refresh_token');
        expect(body).toContain('refresh_token=stored-refresh-token');
        return new Response(
          JSON.stringify({
            access_token: 'access-token-123',
            token_type: 'Bearer',
            expires_in: 300,
            id_token: idToken,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      return new Response('unexpected', { status: 500 });
    });

    const service = new OidcService({
      config: baseConfig,
      tokenStore: store,
      openExternal: async () => undefined,
      fetchFn,
    });

    const summary = await service.getSessionSummary();

    expect(summary.ok).toBe(true);
    if (summary.ok) {
      expect(summary.data.state).toBe('active');
      expect(summary.data.userId).toBe('user-123');
      expect(summary.data.email).toBe('user@example.com');
    }

    expect(store.set).toHaveBeenCalledWith('stored-refresh-token');
  });
});
