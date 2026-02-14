import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import {
  asFailure,
  CONTRACT_VERSION,
  type DesktopResult,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerValidatedHandler } from './register-validated-handler';

describe('registerValidatedHandler', () => {
  const createInvokePayload = (correlationId: string) => ({
    contractVersion: CONTRACT_VERSION,
    correlationId,
    payload: {},
  });

  const createContext = (): MainIpcContext => ({
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
    logEvent: vi.fn(),
  });

  const register = (
    context: MainIpcContext,
    handler: (event: IpcMainInvokeEvent, request: unknown) => unknown,
  ) => {
    const handlers = new Map<
      string,
      (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown>
    >();
    const ipcMain = {
      handle: (
        channel: string,
        registeredHandler: (...args: unknown[]) => unknown,
      ) => {
        handlers.set(
          channel,
          registeredHandler as (
            event: IpcMainInvokeEvent,
            payload: unknown,
          ) => Promise<unknown>,
        );
      },
    } as unknown as IpcMain;

    registerValidatedHandler({
      ipcMain,
      channel: 'test:channel',
      schema: z.object({
        contractVersion: z.string(),
        correlationId: z.string(),
        payload: z.object({}).strict(),
      }),
      context,
      handler: handler as (
        event: IpcMainInvokeEvent,
        request: {
          contractVersion: string;
          correlationId: string;
          payload: Record<string, never>;
        },
      ) => unknown,
    });

    return handlers.get('test:channel');
  };

  it('normalizes sync handler exceptions into IPC/HANDLER_FAILED', async () => {
    const context = createContext();
    const invoke = register(context, () => {
      throw new Error('sync boom');
    });
    expect(invoke).toBeDefined();

    const result = await invoke!(
      {} as IpcMainInvokeEvent,
      createInvokePayload('corr-sync-throw'),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'IPC/HANDLER_FAILED',
        correlationId: 'corr-sync-throw',
      },
    });
    expect(context.logEvent).toHaveBeenCalledWith(
      'error',
      'ipc.handler_unhandled_exception',
      'corr-sync-throw',
      expect.objectContaining({
        channel: 'test:channel',
      }),
    );
  });

  it('normalizes async handler rejections into IPC/HANDLER_FAILED', async () => {
    const context = createContext();
    const invoke = register(context, async () => {
      throw new Error('async boom');
    });
    expect(invoke).toBeDefined();

    const result = await invoke!(
      {} as IpcMainInvokeEvent,
      createInvokePayload('corr-async-throw'),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'IPC/HANDLER_FAILED',
        correlationId: 'corr-async-throw',
      },
    });
  });

  it('preserves unauthorized sender short-circuit behavior', async () => {
    const context = createContext();
    context.assertAuthorizedSender = (_event, correlationId) =>
      asFailure(
        'IPC/UNAUTHORIZED_SENDER',
        'IPC sender is not authorized for this operation.',
        { reason: 'test' },
        false,
        correlationId,
      ) as DesktopResult<never>;

    const invoke = register(context, vi.fn());
    expect(invoke).toBeDefined();

    const result = await invoke!(
      {} as IpcMainInvokeEvent,
      createInvokePayload('corr-unauthorized'),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'IPC/UNAUTHORIZED_SENDER',
        correlationId: 'corr-unauthorized',
      },
    });
  });
});
