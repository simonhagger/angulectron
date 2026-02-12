import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  safeStorage,
  session,
  type IpcMainInvokeEvent,
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

const runtimeSmokeEnabled = process.env.RUNTIME_SMOKE === '1';
const isDevelopment = !app.isPackaged && !runtimeSmokeEnabled;
const rendererDevUrl = process.env.RENDERER_DEV_URL ?? 'http://localhost:4200';
const fileTokenTtlMs = 5 * 60 * 1000;
const fileTokenCleanupIntervalMs = 60 * 1000;
const runtimeSmokeSettleMs = 4_000;
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

const enableRuntimeSmokeMode = (window: BrowserWindow) => {
  const diagnostics: string[] = [];
  const pushDiagnostic = (message: string) => {
    diagnostics.push(message);
  };

  window.webContents.on('console-message', (details) => {
    if (details.level === 'warning' || details.level === 'error') {
      const label = details.level === 'warning' ? 'warn' : 'error';
      pushDiagnostic(
        `${label} ${details.sourceId}:${details.lineNumber} ${details.message}`,
      );
    }
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    pushDiagnostic(`render-process-gone: ${details.reason}`);
  });

  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    pushDiagnostic(`did-fail-load: ${code} ${description} ${url}`);
  });

  window.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try {
        await window.webContents.executeJavaScript(`
          (() => {
            const labels = ['Material', 'Carbon', 'Tailwind'];
            let delay = 150;
            for (const label of labels) {
              setTimeout(() => {
                const candidates = [...document.querySelectorAll('a,[role="link"],button')];
                const target = candidates.find((el) =>
                  (el.textContent || '').toLowerCase().includes(label.toLowerCase())
                );
                target?.click();
              }, delay);
              delay += 250;
            }
          })();
        `);
      } catch (error) {
        pushDiagnostic(
          `route-probe-failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      setTimeout(() => {
        if (diagnostics.length > 0) {
          console.error('Runtime smoke failed due to renderer diagnostics.');
          for (const message of diagnostics) {
            console.error(`- ${message}`);
          }
          app.exit(1);
          return;
        }

        console.info('Runtime smoke passed: no renderer warnings or errors.');
        app.exit(0);
      }, runtimeSmokeSettleMs);
    }, 250);
  });
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
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  hardenWebContents(window.webContents);
  if (runtimeSmokeEnabled) {
    enableRuntimeSmokeMode(window);
  }

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
    if (!runtimeSmokeEnabled) {
      window.webContents.openDevTools({ mode: 'detach' });
    }
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

const assertAuthorizedSender = (
  event: IpcMainInvokeEvent,
  correlationId?: string,
) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  const senderUrl = event.senderFrame?.url ?? event.sender.getURL();
  const authorized =
    senderWindow?.id === mainWindow?.id && isAllowedNavigation(senderUrl);

  if (!authorized) {
    return asFailure(
      'IPC/UNAUTHORIZED_SENDER',
      'IPC sender is not authorized for this operation.',
      {
        senderWindowId: senderWindow?.id ?? null,
        expectedWindowId: mainWindow?.id ?? null,
        senderUrl,
      },
      false,
      correlationId,
    );
  }

  return null;
};

const redactTelemetryProperties = (
  properties: Record<string, string | number | boolean> | undefined,
): Record<string, string | number | boolean> => {
  if (!properties) {
    return {};
  }

  const sensitiveKeyPattern =
    /token|secret|password|credential|api[-_]?key|auth/i;
  const redacted: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(properties)) {
    redacted[key] = sensitiveKeyPattern.test(key) ? '[REDACTED]' : value;
  }

  return redacted;
};

const registerIpcHandlers = () => {
  ipcMain.handle(IPC_CHANNELS.handshake, (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

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

  ipcMain.handle(IPC_CHANNELS.appGetVersion, (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

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
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

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

  ipcMain.handle(IPC_CHANNELS.fsReadTextFile, async (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

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

      const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
      if (senderWindowId !== selected.windowId) {
        selectedFileTokens.delete(parsed.data.payload.fileToken);
        return asFailure(
          'FS/INVALID_TOKEN_SCOPE',
          'Selected file token was issued for a different window.',
          {
            senderWindowId: senderWindowId ?? null,
            tokenWindowId: selected.windowId,
          },
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

  ipcMain.handle(IPC_CHANNELS.apiInvoke, async (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

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

  ipcMain.handle(IPC_CHANNELS.storageSetItem, (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

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

  ipcMain.handle(IPC_CHANNELS.storageGetItem, (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

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

  ipcMain.handle(IPC_CHANNELS.storageDeleteItem, (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

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

  ipcMain.handle(IPC_CHANNELS.storageClearDomain, (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

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

  ipcMain.handle(IPC_CHANNELS.updatesCheck, async (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

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

  ipcMain.handle(IPC_CHANNELS.telemetryTrack, (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

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
      properties: redactTelemetryProperties(parsed.data.payload.properties),
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
