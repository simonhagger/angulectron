import { describe, expect, it } from 'vitest';
import { loadOidcConfig } from './oidc-config';

describe('loadOidcConfig', () => {
  it('returns null when OIDC env vars are not provided', () => {
    const config = loadOidcConfig({});
    expect(config).toBeNull();
  });

  it('loads valid OIDC config values', () => {
    const config = loadOidcConfig({
      OIDC_ISSUER: 'https://issuer.example.com/',
      OIDC_CLIENT_ID: 'desktop-client',
      OIDC_REDIRECT_URI: 'http://127.0.0.1:42813/callback',
      OIDC_SCOPES: 'openid profile email',
      OIDC_AUDIENCE: 'api://desktop',
    });

    expect(config).toEqual({
      issuer: 'https://issuer.example.com',
      clientId: 'desktop-client',
      redirectUri: 'http://127.0.0.1:42813/callback',
      scopes: ['openid', 'profile', 'email'],
      audience: 'api://desktop',
    });
  });

  it('throws when required fields are missing', () => {
    expect(() =>
      loadOidcConfig({
        OIDC_ISSUER: 'https://issuer.example.com',
      }),
    ).toThrow(/OIDC configuration is incomplete/i);
  });

  it('throws when openid scope is missing', () => {
    expect(() =>
      loadOidcConfig({
        OIDC_ISSUER: 'https://issuer.example.com',
        OIDC_CLIENT_ID: 'desktop-client',
        OIDC_REDIRECT_URI: 'http://127.0.0.1:42813/callback',
        OIDC_SCOPES: 'profile email',
      }),
    ).toThrow(/must include "openid"/i);
  });
});
