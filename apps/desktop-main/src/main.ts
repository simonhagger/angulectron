import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
import { invokeApiOperation } from './api-gateway';
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
    return invokeApiOperation(parsed.data);
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
