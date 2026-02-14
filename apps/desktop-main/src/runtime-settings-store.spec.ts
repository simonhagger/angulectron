import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RuntimeSettingsStore } from './runtime-settings-store';

describe('RuntimeSettingsStore', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(
      os.tmpdir(),
      `runtime-settings-store-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns default config when runtime config file does not exist', async () => {
    const store = new RuntimeSettingsStore(tempDir);

    const state = await store.getState();
    expect(state.exists).toBe(false);
    expect(state.config).toEqual({ version: 1 });
  });

  it('saves and resets feature config', async () => {
    const store = new RuntimeSettingsStore(tempDir);

    await store.saveFeature('auth', {
      issuer: 'https://issuer.example.com',
      clientId: 'desktop-client',
    });

    const stateAfterSave = await store.getState();
    expect(stateAfterSave.exists).toBe(true);
    expect(stateAfterSave.config.auth?.issuer).toBe(
      'https://issuer.example.com',
    );

    await store.resetFeature('auth');

    const stateAfterReset = await store.getState();
    expect(stateAfterReset.config.auth).toBeUndefined();
  });

  it('imports feature config from full runtime config document', async () => {
    const store = new RuntimeSettingsStore(tempDir);
    const importFile = path.join(tempDir, 'import.auth.json');
    writeFileSync(
      importFile,
      JSON.stringify(
        {
          version: 1,
          auth: {
            issuer: 'https://issuer.example.com',
            clientId: 'imported-client',
            redirectUri: 'http://127.0.0.1:42813/callback',
            scopes: 'openid profile email',
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const saved = await store.importFeatureConfigFromFile('auth', importFile);
    expect(saved.auth?.clientId).toBe('imported-client');
  });

  it('migrates legacy app secure endpoint config into api config', async () => {
    const store = new RuntimeSettingsStore(tempDir);
    const runtimeConfigPath = store.getConfigFilePath();
    mkdirSync(path.dirname(runtimeConfigPath), { recursive: true });
    writeFileSync(
      runtimeConfigPath,
      JSON.stringify(
        {
          version: 1,
          app: {
            secureEndpointUrlTemplate:
              'https://api.example.com/resources/{{resource_id}}',
            secureEndpointClaimMap: {
              resource_id: 'sub',
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const state = await store.getState();
    expect(state.config.api?.secureEndpointUrlTemplate).toContain(
      '{{resource_id}}',
    );
    expect(state.config.app).toEqual({});
  });

  it('decodes URL-encoded placeholder braces in api secure endpoint template', async () => {
    const store = new RuntimeSettingsStore(tempDir);
    const runtimeConfigPath = store.getConfigFilePath();
    mkdirSync(path.dirname(runtimeConfigPath), { recursive: true });
    writeFileSync(
      runtimeConfigPath,
      JSON.stringify(
        {
          version: 1,
          api: {
            secureEndpointUrlTemplate:
              'https://api.example.com/resources/%7B%7Bresource_id%7D%7D',
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const state = await store.getState();
    expect(state.config.api?.secureEndpointUrlTemplate).toBe(
      'https://api.example.com/resources/{{resource_id}}',
    );
  });
});
