import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadUserRuntimeConfig } from './runtime-user-config';

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

  it('loads allowed values from runtime-config.env', () => {
    writeFileSync(
      path.join(tempDir, 'config', 'runtime-config.env'),
      [
        '# comment',
        'OIDC_ISSUER=https://issuer.example.com',
        'OIDC_CLIENT_ID=desktop-client',
        'UNSAFE_KEY=ignored',
      ].join('\n'),
      'utf8',
    );

    const env: NodeJS.ProcessEnv = {};
    const result = loadUserRuntimeConfig(tempDir, env);
    expect(result.parseError).toBeUndefined();
    expect(env.OIDC_ISSUER).toBe('https://issuer.example.com');
    expect(env.OIDC_CLIENT_ID).toBe('desktop-client');
    expect(env.UNSAFE_KEY).toBeUndefined();
    expect(result.appliedKeys).toEqual(['OIDC_ISSUER', 'OIDC_CLIENT_ID']);
  });

  it('respects existing env values over file values', () => {
    writeFileSync(
      path.join(tempDir, 'config', 'runtime-config.env'),
      'OIDC_CLIENT_ID=file-client\nOIDC_SCOPES=openid profile',
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
