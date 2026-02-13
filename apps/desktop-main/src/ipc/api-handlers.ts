import type { IpcMain } from 'electron';
import {
  apiGetOperationDiagnosticsRequestSchema,
  apiInvokeRequestSchema,
  IPC_CHANNELS,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerValidatedHandler } from './register-validated-handler';

export const registerApiIpcHandlers = (
  ipcMain: IpcMain,
  context: MainIpcContext,
) => {
  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.apiInvoke,
    schema: apiInvokeRequestSchema,
    context,
    handler: (_event, request) => context.invokeApiOperation(request),
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.apiGetOperationDiagnostics,
    schema: apiGetOperationDiagnosticsRequestSchema,
    context,
    handler: (_event, request) =>
      context.getApiOperationDiagnostics(request.payload.operationId),
  });
};
