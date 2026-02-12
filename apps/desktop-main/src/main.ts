import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  safeStorage,
  session,
  type WebContents,
} from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
import { invokeApiOperation } from './api-gateway';
import { StorageGateway } from './storage-gateway';
import {
  apiInvokeRequestSchema,
  appVersionRequestSchema,
  asFailure,
  asSuccess,
  CONTRACT_VERSION,
  handshakeRequestSchema,
  IPC_CHANNELS,
  openFileDialogRequestSchema,
  readTextFileRequestSchema,
  storageClearDomainRequestSchema,
  storageDeleteRequestSchema,
  storageGetRequestSchema,
  storageSetRequestSchema,
  telemetryTrackRequestSchema,
  updatesCheckRequestSchema,
} from '@electron-foundation/contracts';
import { toStructuredLogLine } from '@electron-foundation/common';

const isDevelopment = !app.isPackaged;
const rendererDevUrl = process.env.RENDERER_DEV_URL ?? 'http://localhost:4200';
const fileTokenTtlMs = 5 * 60 * 1000;
const fileTokenCleanupIntervalMs = 60 * 1000;
const allowedDevHosts = new Set(['localhost', '127.0.0.1']);

const resolveExistingPath = (
  description: string,
  candidates: string[],
): string => {
  for (const candidate of candidates) {
    const absolutePath = path.resolve(__dirname, candidate);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  throw new Error(
    `Unable to resolve ${description}. Checked: ${candidates
      .map((candidate) => path.resolve(__dirname, candidate))
      .join(', ')}`,
  );
};

const resolvePreloadPath = (): string =>
  resolveExistingPath('preload script', [
    '../desktop-preload/main.js',
    '../apps/desktop-preload/main.js',
    '../../desktop-preload/main.js',
    '../../../desktop-preload/main.js',
    '../../../../desktop-preload/main.js',
    '../desktop-preload/src/main.js',
    '../apps/desktop-preload/src/main.js',
    '../../desktop-preload/src/main.js',
    '../../../desktop-preload/src/main.js',
  ]);

const resolveRendererIndexPath = (): string =>
  resolveExistingPath('renderer index', [
    '../../../../renderer/browser/index.html',
    '../renderer/browser/index.html',
    '../../renderer/browser/index.html',
    '../../../renderer/browser/index.html',
  ]);

type FileSelectionToken = {
  filePath: string;
  expiresAt: number;
  windowId: number;
};

const selectedFileTokens = new Map<string, FileSelectionToken>();
let tokenCleanupTimer: NodeJS.Timeout | null = null;
let storageGateway: StorageGateway | null = null;
let mainWindow: BrowserWindow | null = null;
const APP_VERSION = app.getVersion();

const logEvent = (
  level: 'debug' | 'info' | 'warn' | 'error',
  event: string,
  correlationId?: string,
  details?: Record<string, unknown>,
) => {
  const line = toStructuredLogLine({
    level,
    component: 'desktop-main',
    event,
    version: APP_VERSION,
    correlationId,
    details,
  });

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.info(line);
};

const resolveRendererDevUrl = (): URL => {
  const parsed = new URL(rendererDevUrl);
  if (parsed.protocol !== 'http:' || !allowedDevHosts.has(parsed.hostname)) {
    throw new Error(
      `RENDERER_DEV_URL must use http://localhost or http://127.0.0.1. Received: ${rendererDevUrl}`,
    );
  }

  return parsed;
};

const isAllowedNavigation = (targetUrl: string): boolean => {
  try {
    const parsed = new URL(targetUrl);
    if (isDevelopment) {
      const allowedDevUrl = resolveRendererDevUrl();
      return parsed.origin === allowedDevUrl.origin;
    }

    return parsed.protocol === 'file:';
  } catch {
    return false;
  }
};

const hardenWebContents = (contents: WebContents) => {
  contents.setWindowOpenHandler(({ url }) => {
    logEvent('warn', 'security.window_open_blocked', undefined, { url });
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      logEvent('warn', 'security.navigation_blocked', undefined, { url });
    }
  });
};

const startFileTokenCleanup = () => {
  if (tokenCleanupTimer) {
    return;
  }

  tokenCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [token, value] of selectedFileTokens) {
      if (value.expiresAt <= now) {
        selectedFileTokens.delete(token);
      }
    }
  }, fileTokenCleanupIntervalMs);
};

const stopFileTokenCleanup = () => {
  if (!tokenCleanupTimer) {
    return;
  }

  clearInterval(tokenCleanupTimer);
  tokenCleanupTimer = null;
};

const clearFileTokensForWindow = (windowId: number) => {
  for (const [token, value] of selectedFileTokens) {
    if (value.windowId === windowId) {
      selectedFileTokens.delete(token);
    }
  }
};

const createMainWindow = async (): Promise<BrowserWindow> => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#f8f7f1',
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  hardenWebContents(window.webContents);

  window.on('closed', () => {
    clearFileTokensForWindow(window.id);
    if (mainWindow?.id === window.id) {
      mainWindow = null;
    }
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  if (isDevelopment) {
    await window.loadURL(resolveRendererDevUrl().toString());
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    await window.loadFile(resolveRendererIndexPath());
  }

  return window;
};

const getCorrelationId = (payload: unknown): string | undefined => {
  if (
    payload &&
    typeof payload === 'object' &&
    'correlationId' in payload &&
    typeof (payload as { correlationId?: unknown }).correlationId === 'string'
  ) {
    return (payload as { correlationId: string }).correlationId;
  }

  return undefined;
};

const registerIpcHandlers = () => {
  ipcMain.handle(IPC_CHANNELS.handshake, (_event, payload) => {
    const correlationId = getCorrelationId(payload);
    const parsed = handshakeRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    return asSuccess({ contractVersion: CONTRACT_VERSION });
  });

  ipcMain.handle(IPC_CHANNELS.appGetVersion, (_event, payload) => {
    const correlationId = getCorrelationId(payload);
    const parsed = appVersionRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    return asSuccess({ version: app.getVersion() });
  });

  ipcMain.handle(IPC_CHANNELS.dialogOpenFile, async (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const parsed = openFileDialogRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    const result = await dialog.showOpenDialog({
      title: parsed.data.payload.title,
      filters: parsed.data.payload.filters,
      properties: ['openFile'],
    });

    const selectedPath = result.filePaths[0];
    if (result.canceled || !selectedPath) {
      return asSuccess({ canceled: true });
    }

    const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
    if (!windowId) {
      return asFailure(
        'FS/TOKEN_CREATION_FAILED',
        'Unable to associate selected file with a window context.',
        undefined,
        false,
        parsed.data.correlationId,
      );
    }

    const fileToken = randomUUID();
    selectedFileTokens.set(fileToken, {
      filePath: selectedPath,
      windowId,
      expiresAt: Date.now() + fileTokenTtlMs,
    });

    return asSuccess({
      canceled: false,
      fileName: path.basename(selectedPath),
      fileToken,
    });
  });

  ipcMain.handle(IPC_CHANNELS.fsReadTextFile, async (_event, payload) => {
    const correlationId = getCorrelationId(payload);
    const parsed = readTextFileRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    try {
      const selected = selectedFileTokens.get(parsed.data.payload.fileToken);
      if (!selected || selected.expiresAt <= Date.now()) {
        selectedFileTokens.delete(parsed.data.payload.fileToken);
        return asFailure(
          'FS/INVALID_TOKEN',
          'The selected file token is invalid or expired.',
          undefined,
          false,
          parsed.data.correlationId,
        );
      }

      // Tokens are single-use to reduce replay risk from compromised renderers.
      selectedFileTokens.delete(parsed.data.payload.fileToken);

      const content = await fs.readFile(selected.filePath, {
        encoding: parsed.data.payload.encoding,
      });

      return asSuccess({ content });
    } catch (error) {
      return asFailure(
        'FS/READ_FAILED',
        'Unable to read requested file.',
        error,
        false,
        parsed.data.correlationId,
      );
    }
  });

  ipcMain.handle(IPC_CHANNELS.apiInvoke, async (_event, payload) => {
    const correlationId = getCorrelationId(payload);
    const parsed = apiInvokeRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }
    return invokeApiOperation(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.storageSetItem, (_event, payload) => {
    const correlationId = getCorrelationId(payload);
    const parsed = storageSetRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    return storageGateway!.setItem(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.storageGetItem, (_event, payload) => {
    const correlationId = getCorrelationId(payload);
    const parsed = storageGetRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    return storageGateway!.getItem(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.storageDeleteItem, (_event, payload) => {
    const correlationId = getCorrelationId(payload);
    const parsed = storageDeleteRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    return storageGateway!.deleteItem(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.storageClearDomain, (_event, payload) => {
    const correlationId = getCorrelationId(payload);
    const parsed = storageClearDomainRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    return storageGateway!.clearDomain(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.updatesCheck, async (_event, payload) => {
    const correlationId = getCorrelationId(payload);
    const parsed = updatesCheckRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    try {
      const updateConfigPath = path.join(
        process.resourcesPath,
        'app-update.yml',
      );
      if (!existsSync(updateConfigPath)) {
        return asSuccess({
          status: 'error' as const,
          message:
            'Update checks are not configured for this build. Use installer/release artifacts for update testing.',
        });
      }

      const updateCheck = await autoUpdater.checkForUpdates();
      const candidateVersion = updateCheck?.updateInfo?.version;
      const currentVersion = app.getVersion();
      const hasUpdate =
        typeof candidateVersion === 'string' &&
        candidateVersion.length > 0 &&
        candidateVersion !== currentVersion;

      if (hasUpdate) {
        return asSuccess({
          status: 'available' as const,
          message: `Update ${candidateVersion} is available.`,
        });
      }

      return asSuccess({ status: 'not-available' as const });
    } catch (error) {
      return asSuccess({
        status: 'error' as const,
        message:
          error instanceof Error ? error.message : 'Update check failed.',
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.telemetryTrack, (_event, payload) => {
    const correlationId = getCorrelationId(payload);
    const parsed = telemetryTrackRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    logEvent('info', 'telemetry.track', parsed.data.correlationId, {
      eventName: parsed.data.payload.eventName,
      properties: parsed.data.payload.properties ?? {},
    });

    return asSuccess({ accepted: true });
  });
};

const bootstrap = async () => {
  await app.whenReady();
  startFileTokenCleanup();

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );

  storageGateway = new StorageGateway({
    dbPath: path.join(app.getPath('userData'), 'storage', 'app-storage.sqlite'),
    encryptString: safeStorage.isEncryptionAvailable()
      ? (plainText) => safeStorage.encryptString(plainText)
      : undefined,
    decryptString: safeStorage.isEncryptionAvailable()
      ? (cipherText) => safeStorage.decryptString(cipherText)
      : undefined,
  });
  registerIpcHandlers();
  mainWindow = await createMainWindow();
  logEvent('info', 'app.bootstrapped');

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createMainWindow();
    }
  });
};

app.on('window-all-closed', () => {
  selectedFileTokens.clear();
  stopFileTokenCleanup();
  storageGateway?.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

bootstrap().catch((error) => {
  logEvent('error', 'app.bootstrap_failed', undefined, {
    message: error instanceof Error ? error.message : String(error),
  });
  app.exit(1);
});
