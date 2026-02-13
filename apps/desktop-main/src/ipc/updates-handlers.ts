import { existsSync } from 'node:fs';
import path from 'node:path';
import { app, type IpcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import {
  asSuccess,
  IPC_CHANNELS,
  updatesApplyDemoPatchRequestSchema,
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
          const demoUpdater = context.getDemoUpdater();
          if (!demoUpdater) {
            return asSuccess({
              status: 'error' as const,
              message:
                'Update checks are not configured for this build and demo updater is unavailable.',
            });
          }

          return demoUpdater.check();
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
            source: 'native' as const,
            currentVersion,
            latestVersion: candidateVersion,
          });
        }

        return asSuccess({
          status: 'not-available' as const,
          source: 'native' as const,
          currentVersion,
          latestVersion: currentVersion,
        });
      } catch (error) {
        return asSuccess({
          status: 'error' as const,
          message:
            error instanceof Error ? error.message : 'Update check failed.',
          source: 'native' as const,
        });
      }
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.updatesApplyDemoPatch,
    schema: updatesApplyDemoPatchRequestSchema,
    context,
    handler: async () => {
      const demoUpdater = context.getDemoUpdater();
      if (!demoUpdater) {
        return asSuccess({
          applied: false,
          status: 'error' as const,
          source: 'demo' as const,
          message: 'Demo updater is unavailable for this build.',
        });
      }

      return demoUpdater.applyPatch();
    },
  });
};
