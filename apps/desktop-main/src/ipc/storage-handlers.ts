import type { IpcMain } from 'electron';
import {
  IPC_CHANNELS,
  storageClearDomainRequestSchema,
  storageDeleteRequestSchema,
  storageGetRequestSchema,
  storageSetRequestSchema,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerValidatedHandler } from './register-validated-handler';

export const registerStorageIpcHandlers = (
  ipcMain: IpcMain,
  context: MainIpcContext,
) => {
  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.storageSetItem,
    schema: storageSetRequestSchema,
    context,
    handler: (_event, request) => context.getStorageGateway().setItem(request),
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.storageGetItem,
    schema: storageGetRequestSchema,
    context,
    handler: (_event, request) => context.getStorageGateway().getItem(request),
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.storageDeleteItem,
    schema: storageDeleteRequestSchema,
    context,
    handler: (_event, request) =>
      context.getStorageGateway().deleteItem(request),
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.storageClearDomain,
    schema: storageClearDomainRequestSchema,
    context,
    handler: (_event, request) =>
      context.getStorageGateway().clearDomain(request),
  });
};
