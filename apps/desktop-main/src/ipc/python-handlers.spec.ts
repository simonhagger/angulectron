import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import {
  CONTRACT_VERSION,
  IPC_CHANNELS,
  type DesktopResult,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerPythonIpcHandlers } from './python-handlers';

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(() => ({ id: 42 })),
  },
}));

describe('registerPythonIpcHandlers', () => {
  const senderWindowId = 42;

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

    registerPythonIpcHandlers(ipcMain, context);
    return handlers;
  };

  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'python-ipc-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createContext = (options: {
    selectedFileTokens?: MainIpcContext['selectedFileTokens'];
    sidecar?: MainIpcContext['getPythonSidecar'];
  }): MainIpcContext => ({
    appVersion: '0.0.0-test',
    appEnvironment: 'development',
    fileTokenTtlMs: 5 * 60_000,
    selectedFileTokens: options.selectedFileTokens ?? new Map(),
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
    getPythonSidecar: options.sidecar ?? vi.fn(() => null),
    getRuntimeSettingsStore: vi.fn(() => {
      throw new Error('not-used');
    }),
    logEvent: vi.fn(),
  });

  it('passes a validated PDF token to the python sidecar inspect operation', async () => {
    const filePath = path.join(tempDir, 'safe.pdf');
    await fs.writeFile(filePath, Buffer.from('%PDF-1.7\nsafe\n', 'ascii'));

    const selectedFileTokens = new Map([
      [
        'token-1',
        {
          filePath,
          expiresAt: Date.now() + 60_000,
          windowId: senderWindowId,
        },
      ],
    ]);

    const inspectPdf = vi.fn(async () => ({
      accepted: true,
      fileName: 'safe.pdf',
      fileSizeBytes: 14,
      headerHex: '255044462d',
      pythonVersion: '3.12.0',
      pymupdfAvailable: false,
      message: 'PDF inspected by python sidecar.',
    }));

    const handlers = registerHandlers(
      createContext({
        selectedFileTokens,
        sidecar: vi.fn(() => ({
          inspectPdf,
        })) as MainIpcContext['getPythonSidecar'],
      }),
    );

    const inspectHandler = handlers.get(IPC_CHANNELS.pythonInspectPdf);
    expect(inspectHandler).toBeDefined();

    const response = await inspectHandler!(
      createEvent(),
      createRequest('corr-pdf-ok', { fileToken: 'token-1' }),
    );

    expect(response).toMatchObject({
      ok: true,
      data: {
        accepted: true,
        fileName: 'safe.pdf',
      },
    });
    expect(inspectPdf).toHaveBeenCalledWith(filePath);
    expect(selectedFileTokens.has('token-1')).toBe(false);
  });

  it('rejects PDF inspect when the selected file signature is not PDF', async () => {
    const filePath = path.join(tempDir, 'fake.pdf');
    await fs.writeFile(filePath, Buffer.from('HELLO-WORLD', 'ascii'));

    const selectedFileTokens = new Map([
      [
        'token-2',
        {
          filePath,
          expiresAt: Date.now() + 60_000,
          windowId: senderWindowId,
        },
      ],
    ]);

    const inspectPdf = vi.fn();

    const handlers = registerHandlers(
      createContext({
        selectedFileTokens,
        sidecar: vi.fn(() => ({
          inspectPdf,
        })) as MainIpcContext['getPythonSidecar'],
      }),
    );

    const inspectHandler = handlers.get(IPC_CHANNELS.pythonInspectPdf);
    const response = await inspectHandler!(
      createEvent(),
      createRequest('corr-pdf-bad-sig', { fileToken: 'token-2' }),
    );

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'PYTHON/FILE_SIGNATURE_MISMATCH',
        correlationId: 'corr-pdf-bad-sig',
      },
    });
    expect(inspectPdf).not.toHaveBeenCalled();
    expect(selectedFileTokens.has('token-2')).toBe(false);
  });

  it('rejects PDF inspect when token window scope does not match sender window', async () => {
    const filePath = path.join(tempDir, 'safe.pdf');
    await fs.writeFile(filePath, Buffer.from('%PDF-1.7\nsafe\n', 'ascii'));

    const selectedFileTokens = new Map([
      [
        'token-3',
        {
          filePath,
          expiresAt: Date.now() + 60_000,
          windowId: 999,
        },
      ],
    ]);

    const handlers = registerHandlers(
      createContext({
        selectedFileTokens,
        sidecar: vi.fn(() => ({
          inspectPdf: vi.fn(),
        })) as MainIpcContext['getPythonSidecar'],
      }),
    );

    const inspectHandler = handlers.get(IPC_CHANNELS.pythonInspectPdf);
    const response = await inspectHandler!(
      createEvent(),
      createRequest('corr-pdf-scope', { fileToken: 'token-3' }),
    );

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'FS/INVALID_TOKEN_SCOPE',
        correlationId: 'corr-pdf-scope',
      },
    });
    expect(selectedFileTokens.has('token-3')).toBe(false);
  });
});
