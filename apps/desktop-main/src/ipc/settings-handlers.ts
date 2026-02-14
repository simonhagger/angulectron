import {
  dialog,
  BrowserWindow,
  type IpcMain,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
} from 'electron';
import {
  asFailure,
  asSuccess,
  IPC_CHANNELS,
  settingsExportFeatureConfigRequestSchema,
  settingsExportRuntimeConfigRequestSchema,
  settingsGetRuntimeConfigRequestSchema,
  settingsImportFeatureConfigRequestSchema,
  settingsImportRuntimeConfigRequestSchema,
  settingsResetFeatureConfigRequestSchema,
  settingsSaveFeatureConfigRequestSchema,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerValidatedHandler } from './register-validated-handler';
import { syncRuntimeConfigDocumentToEnv } from '../runtime-user-config';
import { refreshDefaultApiOperationsFromEnv } from '../api-gateway';

const settingsImportDialogOptions: OpenDialogOptions = {
  title: 'Import runtime settings',
  filters: [
    {
      name: 'JSON files',
      extensions: ['json'],
    },
  ],
  properties: ['openFile'],
};

const getSenderWindow = (event: IpcMainInvokeEvent) =>
  BrowserWindow.fromWebContents(event.sender) ?? undefined;

export const registerSettingsIpcHandlers = (
  ipcMain: IpcMain,
  context: MainIpcContext,
) => {
  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.settingsGetRuntimeConfig,
    schema: settingsGetRuntimeConfigRequestSchema,
    context,
    handler: async () => {
      const state = await context.getRuntimeSettingsStore().getState();
      return asSuccess(state);
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.settingsSaveFeatureConfig,
    schema: settingsSaveFeatureConfigRequestSchema,
    context,
    handler: async (_event, request) => {
      await context
        .getRuntimeSettingsStore()
        .saveFeature(request.payload.feature, request.payload.config);

      const state = await context.getRuntimeSettingsStore().getState();
      syncRuntimeConfigDocumentToEnv(state.config);
      refreshDefaultApiOperationsFromEnv();
      return asSuccess(state);
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.settingsResetFeatureConfig,
    schema: settingsResetFeatureConfigRequestSchema,
    context,
    handler: async (_event, request) => {
      await context
        .getRuntimeSettingsStore()
        .resetFeature(request.payload.feature);

      const state = await context.getRuntimeSettingsStore().getState();
      syncRuntimeConfigDocumentToEnv(state.config);
      refreshDefaultApiOperationsFromEnv();
      return asSuccess(state);
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.settingsImportFeatureConfig,
    schema: settingsImportFeatureConfigRequestSchema,
    context,
    handler: async (event, request) => {
      const openResult = await dialog.showOpenDialog(
        getSenderWindow(event),
        settingsImportDialogOptions,
      );

      const sourcePath = openResult.filePaths[0];
      if (openResult.canceled || !sourcePath) {
        return asSuccess({
          canceled: true,
          imported: false,
          feature: request.payload.feature,
        });
      }

      try {
        const config = await context
          .getRuntimeSettingsStore()
          .importFeatureConfigFromFile(request.payload.feature, sourcePath);
        syncRuntimeConfigDocumentToEnv(config);
        refreshDefaultApiOperationsFromEnv();

        return asSuccess({
          canceled: false,
          imported: true,
          feature: request.payload.feature,
          sourcePath,
          config,
        });
      } catch (error) {
        return asFailure(
          'SETTINGS/IMPORT_FAILED',
          'Unable to import feature settings from selected file.',
          {
            feature: request.payload.feature,
            sourcePath,
            message: error instanceof Error ? error.message : String(error),
          },
          false,
          request.correlationId,
        );
      }
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.settingsExportFeatureConfig,
    schema: settingsExportFeatureConfigRequestSchema,
    context,
    handler: async (event, request) => {
      const saveResult = await dialog.showSaveDialog(getSenderWindow(event), {
        title: `Export ${request.payload.feature} settings`,
        defaultPath: `runtime-config.${request.payload.feature}.json`,
        filters: [
          {
            name: 'JSON files',
            extensions: ['json'],
          },
        ],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return asSuccess({
          canceled: true,
          exported: false,
          feature: request.payload.feature,
        });
      }

      try {
        await context
          .getRuntimeSettingsStore()
          .exportFeatureConfigToFile(
            request.payload.feature,
            saveResult.filePath,
          );

        return asSuccess({
          canceled: false,
          exported: true,
          feature: request.payload.feature,
          targetPath: saveResult.filePath,
        });
      } catch (error) {
        return asFailure(
          'SETTINGS/EXPORT_FAILED',
          'Unable to export feature settings to selected file.',
          {
            feature: request.payload.feature,
            targetPath: saveResult.filePath,
            message: error instanceof Error ? error.message : String(error),
          },
          false,
          request.correlationId,
        );
      }
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.settingsImportRuntimeConfig,
    schema: settingsImportRuntimeConfigRequestSchema,
    context,
    handler: async (event, request) => {
      const openResult = await dialog.showOpenDialog(
        getSenderWindow(event),
        settingsImportDialogOptions,
      );

      const sourcePath = openResult.filePaths[0];
      if (openResult.canceled || !sourcePath) {
        return asSuccess({
          canceled: true,
          imported: false,
        });
      }

      try {
        const config = await context
          .getRuntimeSettingsStore()
          .importRuntimeConfigFromFile(sourcePath);
        syncRuntimeConfigDocumentToEnv(config);
        refreshDefaultApiOperationsFromEnv();

        return asSuccess({
          canceled: false,
          imported: true,
          sourcePath,
          config,
        });
      } catch (error) {
        return asFailure(
          'SETTINGS/IMPORT_FAILED',
          'Unable to import runtime settings from selected file.',
          {
            sourcePath,
            message: error instanceof Error ? error.message : String(error),
          },
          false,
          request.correlationId,
        );
      }
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.settingsExportRuntimeConfig,
    schema: settingsExportRuntimeConfigRequestSchema,
    context,
    handler: async (event, request) => {
      const saveResult = await dialog.showSaveDialog(getSenderWindow(event), {
        title: 'Export runtime settings',
        defaultPath: 'runtime-config.backup.json',
        filters: [
          {
            name: 'JSON files',
            extensions: ['json'],
          },
        ],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return asSuccess({
          canceled: true,
          exported: false,
        });
      }

      try {
        await context
          .getRuntimeSettingsStore()
          .exportRuntimeConfigToFile(saveResult.filePath);

        return asSuccess({
          canceled: false,
          exported: true,
          targetPath: saveResult.filePath,
        });
      } catch (error) {
        return asFailure(
          'SETTINGS/EXPORT_FAILED',
          'Unable to export runtime settings to selected file.',
          {
            targetPath: saveResult.filePath,
            message: error instanceof Error ? error.message : String(error),
          },
          false,
          request.correlationId,
        );
      }
    },
  });
};
