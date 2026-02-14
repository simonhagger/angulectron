import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadUserRuntimeConfig,
  syncRuntimeConfigDocumentToEnv,
} from './runtime-user-config';

describe('loadUserRuntimeConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(
      os.tmpdir(),
      `runtime-user-config-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    mkdirSync(path.join(tempDir, 'config'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns empty result when no config file exists', () => {
    const env: NodeJS.ProcessEnv = {};
    const result = loadUserRuntimeConfig(tempDir, env);
    expect(result.sourcePath).toBeNull();
    expect(result.appliedKeys).toEqual([]);
    expect(result.skippedExistingKeys).toEqual([]);
  });

  it('loads allowed values from runtime-config.json', () => {
    writeFileSync(
      path.join(tempDir, 'config', 'runtime-config.json'),
      JSON.stringify(
        {
          OIDC_ISSUER: 'https://issuer.example.com',
          OIDC_CLIENT_ID: 'json-client',
          API_SECURE_ENDPOINT_URL_TEMPLATE:
            'https://api.example.com/users/{{user_id}}/portfolio',
          UNSAFE_KEY: 'ignored',
        },
        null,
        2,
      ),
      'utf8',
    );

    const env: NodeJS.ProcessEnv = {};
    const result = loadUserRuntimeConfig(tempDir, env);
    expect(result.parseError).toBeUndefined();
    expect(env.OIDC_ISSUER).toBe('https://issuer.example.com');
    expect(env.OIDC_CLIENT_ID).toBe('json-client');
    expect(env.API_SECURE_ENDPOINT_URL_TEMPLATE).toContain('{{user_id}}');
    expect(env.UNSAFE_KEY).toBeUndefined();
  });

  it('respects existing env values over file values', () => {
    writeFileSync(
      path.join(tempDir, 'config', 'runtime-config.json'),
      JSON.stringify(
        {
          OIDC_CLIENT_ID: 'file-client',
          OIDC_SCOPES: 'openid profile',
        },
        null,
        2,
      ),
      'utf8',
    );

    const env: NodeJS.ProcessEnv = {
      OIDC_CLIENT_ID: 'existing-client',
    };
    const result = loadUserRuntimeConfig(tempDir, env);
    expect(env.OIDC_CLIENT_ID).toBe('existing-client');
    expect(env.OIDC_SCOPES).toBe('openid profile');
    expect(result.skippedExistingKeys).toEqual(['OIDC_CLIENT_ID']);
    expect(result.appliedKeys).toEqual(['OIDC_SCOPES']);
  });

  it('loads values from nested runtime-config.json document shape', () => {
    writeFileSync(
      path.join(tempDir, 'config', 'runtime-config.json'),
      JSON.stringify(
        {
          version: 1,
          api: {
            secureEndpointUrlTemplate:
              'https://api.example.com/resources/{{resource_id}}',
            secureEndpointClaimMap: {
              resource_id: 'sub',
            },
          },
          app: {
            secureEndpointUrlTemplate: 'https://legacy.example.com/{{id}}',
          },
          auth: {
            issuer: 'https://issuer.example.com',
            clientId: 'desktop-client',
            redirectUri: 'http://127.0.0.1:42813/callback',
            scopes: 'openid profile email',
            sendAudienceInAuthorize: true,
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const env: NodeJS.ProcessEnv = {};
    const result = loadUserRuntimeConfig(tempDir, env);
    expect(result.parseError).toBeUndefined();
    expect(env.API_SECURE_ENDPOINT_URL_TEMPLATE).toBe(
      'https://api.example.com/resources/{{resource_id}}',
    );
    expect(env.API_SECURE_ENDPOINT_CLAIM_MAP).toBe('{"resource_id":"sub"}');
    expect(env.OIDC_ISSUER).toBe('https://issuer.example.com');
    expect(env.OIDC_CLIENT_ID).toBe('desktop-client');
    expect(env.OIDC_SEND_AUDIENCE_IN_AUTHORIZE).toBe('1');
  });

  it('returns parseError for invalid json config', () => {
    writeFileSync(
      path.join(tempDir, 'config', 'runtime-config.json'),
      '{ invalid-json',
      'utf8',
    );

    const env: NodeJS.ProcessEnv = {};
    const result = loadUserRuntimeConfig(tempDir, env);
    expect(result.parseError).toBeDefined();
    expect(result.appliedKeys).toEqual([]);
  });
});

describe('syncRuntimeConfigDocumentToEnv', () => {
  it('applies and clears managed keys to match runtime settings document', () => {
    const env: NodeJS.ProcessEnv = {
      OIDC_ISSUER: 'https://old.example.com',
      OIDC_SCOPES: 'openid',
      API_SECURE_ENDPOINT_URL_TEMPLATE: 'https://old.example.com/{{id}}',
      API_SECURE_ENDPOINT_CLAIM_MAP: '{"id":"sub"}',
    };

    const result = syncRuntimeConfigDocumentToEnv(
      {
        version: 1,
        auth: {
          issuer: 'https://issuer.example.com',
          clientId: 'desktop-client',
          redirectUri: 'http://127.0.0.1:42813/callback',
          scopes: 'openid profile email',
        },
        api: {
          secureEndpointUrlTemplate:
            'https://api.example.com/resources/{{resource_id}}',
        },
      },
      env,
    );

    expect(env.OIDC_ISSUER).toBe('https://issuer.example.com');
    expect(env.OIDC_CLIENT_ID).toBe('desktop-client');
    expect(env.OIDC_REDIRECT_URI).toBe('http://127.0.0.1:42813/callback');
    expect(env.OIDC_SCOPES).toBe('openid profile email');
    expect(env.API_SECURE_ENDPOINT_URL_TEMPLATE).toBe(
      'https://api.example.com/resources/{{resource_id}}',
    );
    expect(env.API_SECURE_ENDPOINT_CLAIM_MAP).toBeUndefined();
    expect(result.clearedKeys).toContain('API_SECURE_ENDPOINT_CLAIM_MAP');
  });
});
