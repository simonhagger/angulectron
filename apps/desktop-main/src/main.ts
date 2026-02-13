import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  safeStorage,
  session,
  shell,
  type IpcMainInvokeEvent,
} from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
import {
  getApiOperationDiagnostics,
  invokeApiOperation,
  setOidcAccessTokenResolver,
} from './api-gateway';
import {
  createMainWindow as createDesktopMainWindow,
  isAllowedNavigation,
} from './desktop-window';
import { loadOidcConfig } from './oidc-config';
import { OidcService } from './oidc-service';
import {
  resolveAppMetadataVersion,
  resolveRuntimeFlags,
} from './runtime-config';
import { createRefreshTokenStore } from './secure-token-store';
import { StorageGateway } from './storage-gateway';
import {
  apiGetOperationDiagnosticsRequestSchema,
  apiInvokeRequestSchema,
  authGetSessionSummaryRequestSchema,
  authGetTokenDiagnosticsRequestSchema,
  authSignInRequestSchema,
  authSignOutRequestSchema,
  appRuntimeVersionsRequestSchema,
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

type FileSelectionToken = {
  filePath: string;
  expiresAt: number;
  windowId: number;
};

const selectedFileTokens = new Map<string, FileSelectionToken>();
let tokenCleanupTimer: NodeJS.Timeout | null = null;
let storageGateway: StorageGateway | null = null;
let oidcService: OidcService | null = null;
let mainWindow: BrowserWindow | null = null;
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

    return asSuccess({ version: APP_VERSION });
  });

  ipcMain.handle(IPC_CHANNELS.appGetRuntimeVersions, (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

    const parsed = appRuntimeVersionsRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    return asSuccess({
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      appEnvironment,
    });
  });

  ipcMain.handle(IPC_CHANNELS.authSignIn, (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

    const parsed = authSignInRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    if (!oidcService) {
      return asFailure(
        'AUTH/NOT_CONFIGURED',
        'OIDC authentication is not configured for this build.',
        undefined,
        false,
        parsed.data.correlationId,
      );
    }

    return oidcService.signIn();
  });

  ipcMain.handle(IPC_CHANNELS.authSignOut, (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

    const parsed = authSignOutRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    if (!oidcService) {
      return asSuccess({ signedOut: true });
    }

    return oidcService.signOut();
  });

  ipcMain.handle(IPC_CHANNELS.authGetSessionSummary, (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

    const parsed = authGetSessionSummaryRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    if (!oidcService) {
      return asSuccess({
        state: 'signed-out' as const,
        scopes: [],
        entitlements: [],
      });
    }

    return oidcService.getSessionSummary();
  });

  ipcMain.handle(IPC_CHANNELS.authGetTokenDiagnostics, (event, payload) => {
    const correlationId = getCorrelationId(payload);
    const unauthorized = assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

    const parsed = authGetTokenDiagnosticsRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    if (!oidcService) {
      return asSuccess({
        sessionState: 'signed-out' as const,
        bearerSource: 'access_token' as const,
        accessToken: {
          present: false,
          format: 'absent' as const,
          claims: null,
        },
        idToken: {
          present: false,
          format: 'absent' as const,
          claims: null,
        },
      });
    }

    return oidcService.getTokenDiagnostics();
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

  ipcMain.handle(
    IPC_CHANNELS.apiGetOperationDiagnostics,
    async (event, payload) => {
      const correlationId = getCorrelationId(payload);
      const unauthorized = assertAuthorizedSender(event, correlationId);
      if (unauthorized) {
        return unauthorized;
      }

      const parsed = apiGetOperationDiagnosticsRequestSchema.safeParse(payload);
      if (!parsed.success) {
        return asFailure(
          'IPC/VALIDATION_FAILED',
          'IPC payload failed validation.',
          parsed.error.flatten(),
          false,
          correlationId,
        );
      }

      return getApiOperationDiagnostics(parsed.data.payload.operationId);
    },
  );

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
  oidcService?.dispose();
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
