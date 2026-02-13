import type { IpcMain } from 'electron';
import {
  appRuntimeVersionsRequestSchema,
  appVersionRequestSchema,
  asSuccess,
  CONTRACT_VERSION,
  handshakeRequestSchema,
  IPC_CHANNELS,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerValidatedHandler } from './register-validated-handler';

export const registerAppIpcHandlers = (
  ipcMain: IpcMain,
  context: MainIpcContext,
) => {
  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.handshake,
    schema: handshakeRequestSchema,
    context,
    handler: () => asSuccess({ contractVersion: CONTRACT_VERSION }),
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.appGetVersion,
    schema: appVersionRequestSchema,
    context,
    handler: () => asSuccess({ version: context.appVersion }),
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.appGetRuntimeVersions,
    schema: appRuntimeVersionsRequestSchema,
    context,
    handler: () =>
      asSuccess({
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome,
        appEnvironment: context.appEnvironment,
      }),
  });
};
