import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
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
  telemetryTrackRequestSchema,
  updatesCheckRequestSchema,
} from '@electron-foundation/contracts';

const isDevelopment = process.env.NODE_ENV !== 'production';
const rendererDevUrl = process.env.RENDERER_DEV_URL ?? 'http://localhost:4200';
const selectedFileTokens = new Map<string, string>();
const API_DEFAULT_TIMEOUT_MS = 8_000;
const API_DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;

type ApiOperation = {
  method: 'GET' | 'POST';
  url: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
};

// Operation-based external API access keeps renderer/network boundaries explicit.
const apiOperations: Record<string, ApiOperation> = {
  'status.github': {
    method: 'GET',
    url: 'https://api.github.com/rate_limit',
    timeoutMs: 8_000,
    maxResponseBytes: 256_000,
  },
};

const createMainWindow = async (): Promise<BrowserWindow> => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#f8f7f1',
    webPreferences: {
      preload: path.join(__dirname, '../desktop-preload/main.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDevelopment) {
    await mainWindow.loadURL(rendererDevUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, '../renderer/browser/index.html'),
    );
  }

  return mainWindow;
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

  ipcMain.handle(IPC_CHANNELS.dialogOpenFile, async (_event, payload) => {
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

    const fileToken = randomUUID();
    selectedFileTokens.set(fileToken, selectedPath);

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
      const selectedPath = selectedFileTokens.get(
        parsed.data.payload.fileToken,
      );
      if (!selectedPath) {
        return asFailure(
          'FS_INVALID_TOKEN',
          'The selected file token is invalid or expired.',
          undefined,
          false,
          parsed.data.correlationId,
        );
      }

      // Tokens are single-use to reduce replay risk from compromised renderers.
      selectedFileTokens.delete(parsed.data.payload.fileToken);

      const content = await fs.readFile(selectedPath, {
        encoding: parsed.data.payload.encoding,
      });

      return asSuccess({ content });
    } catch (error) {
      return asFailure(
        'FS_READ_FAILED',
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

    const operation = apiOperations[parsed.data.payload.operationId];
    if (!operation) {
      return asFailure(
        'API/OPERATION_NOT_ALLOWED',
        'Requested API operation is not allowed.',
        { operationId: parsed.data.payload.operationId },
        false,
        parsed.data.correlationId,
      );
    }

    let operationUrl: URL;
    try {
      operationUrl = new URL(operation.url);
    } catch (error) {
      return asFailure(
        'API/OPERATION_CONFIG_INVALID',
        'API operation configuration is invalid.',
        error,
        false,
        parsed.data.correlationId,
      );
    }

    if (operationUrl.protocol !== 'https:') {
      return asFailure(
        'API/INSECURE_DESTINATION',
        'API operation destination must use HTTPS.',
        { operationId: parsed.data.payload.operationId, url: operation.url },
        false,
        parsed.data.correlationId,
      );
    }

    const timeoutMs = operation.timeoutMs ?? API_DEFAULT_TIMEOUT_MS;
    const maxResponseBytes =
      operation.maxResponseBytes ?? API_DEFAULT_MAX_RESPONSE_BYTES;
    const requestUrl = new URL(operationUrl);
    if (operation.method === 'GET' && parsed.data.payload.params) {
      for (const [key, value] of Object.entries(parsed.data.payload.params)) {
        requestUrl.searchParams.set(key, String(value));
      }
    }

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await fetch(requestUrl, {
        method: operation.method,
        headers: {
          Accept: 'application/json',
        },
        redirect: 'manual',
        signal: abortController.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return asFailure(
            'API/REDIRECT_BLOCKED',
            'External API redirect was blocked.',
            { operationId: parsed.data.payload.operationId },
            false,
            parsed.data.correlationId,
          );
        }

        const redirectedUrl = new URL(location, operationUrl);
        if (
          redirectedUrl.protocol !== 'https:' ||
          redirectedUrl.host !== operationUrl.host
        ) {
          return asFailure(
            'API/REDIRECT_BLOCKED',
            'External API redirect destination is not allowed.',
            {
              operationId: parsed.data.payload.operationId,
              redirectHost: redirectedUrl.host,
            },
            false,
            parsed.data.correlationId,
          );
        }
      }

      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const contentLength = Number(contentLengthHeader);
        if (
          Number.isFinite(contentLength) &&
          contentLength > maxResponseBytes
        ) {
          return asFailure(
            'API/PAYLOAD_TOO_LARGE',
            'External API response exceeded allowed size.',
            {
              operationId: parsed.data.payload.operationId,
              contentLength,
            },
            false,
            parsed.data.correlationId,
          );
        }
      }

      const responseText = await response.text();
      const responseBytes = Buffer.byteLength(responseText, 'utf8');
      if (responseBytes > maxResponseBytes) {
        return asFailure(
          'API/PAYLOAD_TOO_LARGE',
          'External API response exceeded allowed size.',
          {
            operationId: parsed.data.payload.operationId,
            responseBytes,
          },
          false,
          parsed.data.correlationId,
        );
      }

      const contentType = response.headers.get('content-type') ?? undefined;
      let responseData: unknown = responseText;
      if (contentType && contentType.includes('application/json')) {
        try {
          responseData = JSON.parse(responseText);
        } catch (error) {
          return asFailure(
            'API/RESPONSE_PARSE_FAILED',
            'External API returned invalid JSON.',
            {
              operationId: parsed.data.payload.operationId,
              error:
                error instanceof Error
                  ? { name: error.name, message: error.message }
                  : String(error),
            },
            false,
            parsed.data.correlationId,
          );
        }
      }

      if (!response.ok) {
        return asFailure(
          'API/HTTP_ERROR',
          'External API returned an error response.',
          {
            operationId: parsed.data.payload.operationId,
            status: response.status,
            bodyPreview: responseText.slice(0, 200),
          },
          response.status >= 500,
          parsed.data.correlationId,
        );
      }

      return asSuccess({
        status: response.status,
        data: responseData,
        contentType,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return asFailure(
          'API/TIMEOUT',
          'External API request timed out.',
          { operationId: parsed.data.payload.operationId, timeoutMs },
          true,
          parsed.data.correlationId,
        );
      }

      return asFailure(
        'API/NETWORK_ERROR',
        'External API request failed.',
        {
          operationId: parsed.data.payload.operationId,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : String(error),
        },
        true,
        parsed.data.correlationId,
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
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
      const updateCheck = await autoUpdater.checkForUpdates();
      const hasUpdate = Boolean(updateCheck?.updateInfo?.version);

      if (hasUpdate) {
        return asSuccess({
          status: 'available' as const,
          message: `Update ${updateCheck?.updateInfo?.version} is available.`,
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

    console.info(
      '[telemetry]',
      parsed.data.correlationId,
      parsed.data.payload.eventName,
      parsed.data.payload.properties ?? {},
    );

    return asSuccess({ accepted: true });
  });
};

const bootstrap = async () => {
  registerIpcHandlers();

  await app.whenReady();
  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

bootstrap().catch((error) => {
  console.error('Failed to bootstrap desktop app.', error);
  app.exit(1);
});
