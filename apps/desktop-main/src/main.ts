import {
  app,
  BrowserWindow,
  Menu,
  safeStorage,
  session,
  shell,
  type IpcMainInvokeEvent,
  ipcMain,
} from 'electron';
import path from 'node:path';
import {
  getApiOperationDiagnostics,
  invokeApiOperation,
  setOidcAccessTokenResolver,
} from './api-gateway';
import {
  createMainWindow as createDesktopMainWindow,
  isAllowedNavigation,
} from './desktop-window';
import { registerIpcHandlers } from './ipc/register-ipc-handlers';
import type { FileSelectionToken } from './ipc/handler-context';
import { loadOidcConfig } from './oidc-config';
import { OidcService } from './oidc-service';
import {
  resolveAppMetadataVersion,
  resolveRuntimeFlags,
} from './runtime-config';
import { createRefreshTokenStore } from './secure-token-store';
import { StorageGateway } from './storage-gateway';
import { DemoUpdater } from './demo-updater';
import { PythonSidecar } from './python-sidecar';
import { asFailure } from '@electron-foundation/contracts';
import { toStructuredLogLine } from '@electron-foundation/common';

const {
  runtimeSmokeEnabled,
  isDevelopment,
  appEnvironment,
  shouldOpenDevTools,
  rendererDevUrl,
} = resolveRuntimeFlags(app);
const navigationPolicy = { isDevelopment, rendererDevUrl };
const fileTokenTtlMs = 5 * 60 * 1000;
const fileTokenCleanupIntervalMs = 60 * 1000;

const selectedFileTokens = new Map<string, FileSelectionToken>();
let tokenCleanupTimer: NodeJS.Timeout | null = null;
let storageGateway: StorageGateway | null = null;
let oidcService: OidcService | null = null;
let mainWindow: BrowserWindow | null = null;
let demoUpdater: DemoUpdater | null = null;
let pythonSidecar: PythonSidecar | null = null;
const APP_VERSION = resolveAppMetadataVersion();

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

const createMainWindow = async (): Promise<BrowserWindow> =>
  createDesktopMainWindow({
    isDevelopment,
    runtimeSmokeEnabled,
    shouldOpenDevTools,
    rendererDevUrl,
    onWindowClosed: (windowId) => {
      clearFileTokensForWindow(windowId);
      if (mainWindow?.id === windowId) {
        mainWindow = null;
      }
    },
    logger: (level, event, details) => {
      logEvent(level, event, undefined, details);
    },
  });

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
    senderWindow?.id === mainWindow?.id &&
    isAllowedNavigation(senderUrl, navigationPolicy);

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

const getStorageGateway = () => {
  if (!storageGateway) {
    throw new Error('Storage gateway is not initialized');
  }

  return storageGateway;
};

const bootstrap = async () => {
  await app.whenReady();
  startFileTokenCleanup();

  logEvent('info', 'app.environment', undefined, {
    appEnvironment,
    isPackaged: app.isPackaged,
    executable: path.basename(process.execPath),
    shouldOpenDevTools,
  });

  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }

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

  const oidcConfig = loadOidcConfig();
  demoUpdater = new DemoUpdater(app.getPath('userData'));
  demoUpdater.seedRuntimeWithBaseline();
  pythonSidecar = new PythonSidecar({
    scriptPath: path.join(__dirname, 'assets', 'python_sidecar', 'service.py'),
    host: process.env.PYTHON_SIDECAR_HOST ?? '127.0.0.1',
    port: Number(process.env.PYTHON_SIDECAR_PORT ?? '43124'),
    logger: (level, event, details) =>
      logEvent(level, event, undefined, details),
  });

  if (oidcConfig) {
    const refreshTokenStore = await createRefreshTokenStore({
      userDataPath: app.getPath('userData'),
      encryptString: safeStorage.isEncryptionAvailable()
        ? (plainText) => safeStorage.encryptString(plainText)
        : undefined,
      decryptString: safeStorage.isEncryptionAvailable()
        ? (cipherText) => safeStorage.decryptString(cipherText)
        : undefined,
      allowInsecurePlaintext:
        process.env.OIDC_ALLOW_INSECURE_TOKEN_STORAGE === '1',
      logger: (level, message) => {
        logEvent(level, 'auth.token_store', undefined, { message });
      },
    });

    oidcService = new OidcService({
      config: oidcConfig,
      tokenStore: refreshTokenStore,
      openExternal: (url) => shell.openExternal(url).then(() => undefined),
      logger: (level, event, details) => {
        logEvent(level, event, undefined, details);
      },
    });

    setOidcAccessTokenResolver(() => oidcService?.getApiBearerToken() ?? null);
  } else {
    logEvent('info', 'auth.not_configured');
    setOidcAccessTokenResolver(null);
  }

  registerIpcHandlers(ipcMain, {
    appVersion: APP_VERSION,
    appEnvironment,
    fileTokenTtlMs,
    selectedFileTokens,
    getCorrelationId,
    assertAuthorizedSender,
    getOidcService: () => oidcService,
    getStorageGateway,
    invokeApiOperation: (request) => invokeApiOperation(request),
    getApiOperationDiagnostics: (operationId) =>
      getApiOperationDiagnostics(operationId),
    getDemoUpdater: () => demoUpdater,
    getPythonSidecar: () => pythonSidecar,
    logEvent,
  });

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
  oidcService?.dispose();
  pythonSidecar?.dispose();
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
