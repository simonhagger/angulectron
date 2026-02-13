import type { IpcMain } from 'electron';
import type { MainIpcContext } from './handler-context';
import { registerApiIpcHandlers } from './api-handlers';
import { registerAppIpcHandlers } from './app-handlers';
import { registerAuthIpcHandlers } from './auth-handlers';
import { registerFileIpcHandlers } from './file-handlers';
import { registerStorageIpcHandlers } from './storage-handlers';
import { registerTelemetryIpcHandlers } from './telemetry-handlers';
import { registerUpdatesIpcHandlers } from './updates-handlers';
import { registerPythonIpcHandlers } from './python-handlers';

export const registerIpcHandlers = (
  ipcMain: IpcMain,
  context: MainIpcContext,
) => {
  registerAppIpcHandlers(ipcMain, context);
  registerAuthIpcHandlers(ipcMain, context);
  registerFileIpcHandlers(ipcMain, context);
  registerApiIpcHandlers(ipcMain, context);
  registerStorageIpcHandlers(ipcMain, context);
  registerUpdatesIpcHandlers(ipcMain, context);
  registerPythonIpcHandlers(ipcMain, context);
  registerTelemetryIpcHandlers(ipcMain, context);
};
