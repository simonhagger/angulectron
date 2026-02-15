import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import {
  CONTRACT_VERSION,
  IPC_CHANNELS,
  type DesktopResult,
} from '@electron-foundation/contracts';
import type { RuntimeSettingsStore } from '../runtime-settings-store';
import type { MainIpcContext } from './handler-context';
import { registerSettingsIpcHandlers } from './settings-handlers';

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(() => ({ id: 42 })),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

describe('registerSettingsIpcHandlers', () => {
  const createRequest = (correlationId: string, payload: unknown) => ({
    contractVersion: CONTRACT_VERSION,
    correlationId,
    payload,
  });

  const createEvent = () =>
    ({
      sender: {},
    }) as IpcMainInvokeEvent;

  const registerHandlers = (
    context: MainIpcContext,
  ): Map<
    string,
    (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown>
  > => {
    const handlers = new Map<
      string,
      (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown>
    >();

    const ipcMain = {
      handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(
          channel,
          handler as (
            event: IpcMainInvokeEvent,
            payload: unknown,
          ) => Promise<unknown>,
        );
      },
    } as unknown as IpcMain;

    registerSettingsIpcHandlers(ipcMain, context);
    return handlers;
  };

  const createRuntimeSettingsStore = () =>
    ({
      getState: vi.fn(async () => ({
        sourcePath: 'config.json',
        exists: false,
        config: { version: 1 },
      })),
      saveFeature: vi.fn(async () => ({ version: 1 })),
      resetFeature: vi.fn(async () => ({ version: 1 })),
      importFeatureConfigFromFile: vi.fn(async () => ({ version: 1 })),
      importRuntimeConfigFromFile: vi.fn(async () => ({ version: 1 })),
      exportFeatureConfigToFile: vi.fn(async () => undefined),
      exportRuntimeConfigToFile: vi.fn(async () => undefined),
    }) as unknown as RuntimeSettingsStore;

  const createContext = (
    runtimeSettingsStore: RuntimeSettingsStore,
  ): MainIpcContext => ({
    appVersion: '0.0.0-test',
    appEnvironment: 'development',
    fileTokenTtlMs: 5 * 60_000,
    selectedFileTokens: new Map(),
    getCorrelationId: (payload: unknown) =>
      payload &&
      typeof payload === 'object' &&
      'correlationId' in payload &&
      typeof (payload as { correlationId?: unknown }).correlationId === 'string'
        ? (payload as { correlationId: string }).correlationId
        : undefined,
    assertAuthorizedSender: () => null as DesktopResult<never> | null,
    getOidcService: vi.fn(() => null),
    getStorageGateway: vi.fn(),
    invokeApiOperation: vi.fn(),
    getApiOperationDiagnostics: vi.fn(),
    getDemoUpdater: vi.fn(() => null),
    getPythonSidecar: vi.fn(() => null),
    getRuntimeSettingsStore: vi.fn(() => runtimeSettingsStore),
    logEvent: vi.fn(),
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-json file for feature settings import', async () => {
    const { dialog } = await import('electron');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['C:/tmp/settings.txt'],
    } as never);

    const runtimeSettingsStore = createRuntimeSettingsStore();
    const context = createContext(runtimeSettingsStore);
    const handlers = registerHandlers(context);
    const importHandler = handlers.get(
      IPC_CHANNELS.settingsImportFeatureConfig,
    );
    expect(importHandler).toBeDefined();

    const response = await importHandler!(
      createEvent(),
      createRequest('corr-settings-import-feature', { feature: 'api' }),
    );

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'SETTINGS/UNSUPPORTED_FILE_TYPE',
        correlationId: 'corr-settings-import-feature',
      },
    });
    expect(context.logEvent).toHaveBeenCalledWith(
      'warn',
      'security.file_ingress_rejected',
      'corr-settings-import-feature',
      expect.objectContaining({
        channel: IPC_CHANNELS.settingsImportFeatureConfig,
        policy: 'settingsJsonImport',
        reason: 'unsupported-extension',
        extension: '.txt',
      }),
    );
    expect(
      vi.mocked(runtimeSettingsStore.importFeatureConfigFromFile),
    ).not.toHaveBeenCalled();
  });

  it('rejects non-json file for runtime settings import', async () => {
    const { dialog } = await import('electron');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['C:/tmp/runtime-config.txt'],
    } as never);

    const runtimeSettingsStore = createRuntimeSettingsStore();
    const context = createContext(runtimeSettingsStore);
    const handlers = registerHandlers(context);
    const importHandler = handlers.get(
      IPC_CHANNELS.settingsImportRuntimeConfig,
    );
    expect(importHandler).toBeDefined();

    const response = await importHandler!(
      createEvent(),
      createRequest('corr-settings-import-runtime', {}),
    );

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'SETTINGS/UNSUPPORTED_FILE_TYPE',
        correlationId: 'corr-settings-import-runtime',
      },
    });
    expect(context.logEvent).toHaveBeenCalledWith(
      'warn',
      'security.file_ingress_rejected',
      'corr-settings-import-runtime',
      expect.objectContaining({
        channel: IPC_CHANNELS.settingsImportRuntimeConfig,
        policy: 'settingsJsonImport',
        reason: 'unsupported-extension',
        extension: '.txt',
      }),
    );
    expect(
      vi.mocked(runtimeSettingsStore.importRuntimeConfigFromFile),
    ).not.toHaveBeenCalled();
  });
});
