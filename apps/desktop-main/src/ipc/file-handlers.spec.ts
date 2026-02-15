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
import { registerFileIpcHandlers } from './file-handlers';

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(() => ({ id: 42 })),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

describe('registerFileIpcHandlers', () => {
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

    registerFileIpcHandlers(ipcMain, context);
    return handlers;
  };

  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-ipc-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createContext = (
    selectedFileTokens?: MainIpcContext['selectedFileTokens'],
  ): MainIpcContext => ({
    appVersion: '0.0.0-test',
    appEnvironment: 'development',
    fileTokenTtlMs: 5 * 60_000,
    selectedFileTokens: selectedFileTokens ?? new Map(),
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
    getRuntimeSettingsStore: vi.fn(() => {
      throw new Error('not-used');
    }),
    logEvent: vi.fn(),
  });

  it('reads selected text file when extension is allowed', async () => {
    const filePath = path.join(tempDir, 'notes.txt');
    await fs.writeFile(filePath, 'hello world', 'utf8');

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

    const context = createContext(selectedFileTokens);
    const handlers = registerHandlers(context);
    const readHandler = handlers.get(IPC_CHANNELS.fsReadTextFile);
    expect(readHandler).toBeDefined();

    const response = await readHandler!(
      createEvent(),
      createRequest('corr-fs-read-ok', {
        fileToken: 'token-1',
        encoding: 'utf8',
      }),
    );

    expect(response).toMatchObject({
      ok: true,
      data: { content: 'hello world' },
    });
    expect(selectedFileTokens.has('token-1')).toBe(false);
  });

  it('rejects selected file when extension is not allowed for text read', async () => {
    const filePath = path.join(tempDir, 'report.pdf');
    await fs.writeFile(filePath, Buffer.from('%PDF-1.7\nsafe\n', 'ascii'));

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

    const context = createContext(selectedFileTokens);
    const handlers = registerHandlers(context);
    const readHandler = handlers.get(IPC_CHANNELS.fsReadTextFile);
    expect(readHandler).toBeDefined();

    const response = await readHandler!(
      createEvent(),
      createRequest('corr-fs-read-bad-ext', {
        fileToken: 'token-2',
        encoding: 'utf8',
      }),
    );

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'FS/UNSUPPORTED_FILE_TYPE',
        correlationId: 'corr-fs-read-bad-ext',
      },
    });
    expect(context.logEvent).toHaveBeenCalledWith(
      'warn',
      'security.file_ingress_rejected',
      'corr-fs-read-bad-ext',
      expect.objectContaining({
        channel: IPC_CHANNELS.fsReadTextFile,
        policy: 'textRead',
        reason: 'unsupported-extension',
        extension: '.pdf',
      }),
    );
    expect(selectedFileTokens.has('token-2')).toBe(false);
  });
});
