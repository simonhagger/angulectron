import { existsSync } from 'node:fs';
import path from 'node:path';
import { app, type IpcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import {
  asSuccess,
  IPC_CHANNELS,
  updatesCheckRequestSchema,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerValidatedHandler } from './register-validated-handler';

export const registerUpdatesIpcHandlers = (
  ipcMain: IpcMain,
  context: MainIpcContext,
) => {
  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.updatesCheck,
    schema: updatesCheckRequestSchema,
    context,
    handler: async () => {
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
    },
  });
};
