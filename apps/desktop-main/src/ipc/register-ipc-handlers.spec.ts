import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import {
  asFailure,
  asSuccess,
  CONTRACT_VERSION,
  IPC_CHANNELS,
  type DesktopResult,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerIpcHandlers } from './register-ipc-handlers';

const createInvokePayload = (correlationId: string) => ({
  contractVersion: CONTRACT_VERSION,
  correlationId,
  payload: {},
});

describe('registerIpcHandlers unauthorized sender integration', () => {
  it('registers all channels and rejects unauthorized senders before handler execution', async () => {
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

    const getStorageGateway = vi.fn(() => ({
      setItem: vi.fn(),
      getItem: vi.fn(),
      deleteItem: vi.fn(),
      clearDomain: vi.fn(),
    }));
    const getOidcService = vi.fn(() => null);
    const invokeApiOperation = vi.fn(async () => asSuccess({ status: 200 }));
    const getApiOperationDiagnostics = vi.fn(() =>
      asSuccess({
        operationId: 'call.secure-endpoint',
        configured: false,
      }),
    );

    const context: MainIpcContext = {
      appVersion: '0.0.0-test',
      appEnvironment: 'development',
      fileTokenTtlMs: 5 * 60_000,
      selectedFileTokens: new Map(),
      getCorrelationId: (payload: unknown) =>
        payload &&
        typeof payload === 'object' &&
        'correlationId' in payload &&
        typeof (payload as { correlationId?: unknown }).correlationId ===
          'string'
          ? (payload as { correlationId: string }).correlationId
          : undefined,
      assertAuthorizedSender: (_event, correlationId) =>
        asFailure(
          'IPC/UNAUTHORIZED_SENDER',
          'IPC sender is not authorized for this operation.',
          { reason: 'test' },
          false,
          correlationId,
        ) as DesktopResult<never>,
      getOidcService,
      getStorageGateway,
      invokeApiOperation,
      getApiOperationDiagnostics,
      getDemoUpdater: vi.fn(() => null),
      logEvent: vi.fn(),
    };

    registerIpcHandlers(ipcMain, context);

    expect(handlers.size).toBe(Object.keys(IPC_CHANNELS).length);

    const privilegedChannels = [
      IPC_CHANNELS.authSignIn,
      IPC_CHANNELS.apiInvoke,
      IPC_CHANNELS.storageGetItem,
      IPC_CHANNELS.updatesCheck,
      IPC_CHANNELS.updatesApplyDemoPatch,
    ];

    for (const channel of privilegedChannels) {
      const correlationId = `corr-${channel}`;
      const handler = handlers.get(channel);
      expect(handler).toBeDefined();
      const response = await handler!(
        {} as IpcMainInvokeEvent,
        createInvokePayload(correlationId),
      );

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'IPC/UNAUTHORIZED_SENDER',
          correlationId,
        },
      });
    }

    expect(getOidcService).not.toHaveBeenCalled();
    expect(getStorageGateway).not.toHaveBeenCalled();
    expect(invokeApiOperation).not.toHaveBeenCalled();
    expect(getApiOperationDiagnostics).not.toHaveBeenCalled();
  });
});
