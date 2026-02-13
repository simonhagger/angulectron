import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BrowserWindow, dialog, type IpcMain } from 'electron';
import {
  asFailure,
  asSuccess,
  IPC_CHANNELS,
  openFileDialogRequestSchema,
  readTextFileRequestSchema,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerValidatedHandler } from './register-validated-handler';

export const registerFileIpcHandlers = (
  ipcMain: IpcMain,
  context: MainIpcContext,
) => {
  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.dialogOpenFile,
    schema: openFileDialogRequestSchema,
    context,
    handler: async (event, request) => {
      const result = await dialog.showOpenDialog({
        title: request.payload.title,
        filters: request.payload.filters,
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
          request.correlationId,
        );
      }

      const fileToken = randomUUID();
      context.selectedFileTokens.set(fileToken, {
        filePath: selectedPath,
        windowId,
        expiresAt: Date.now() + context.fileTokenTtlMs,
      });

      return asSuccess({
        canceled: false,
        fileName: path.basename(selectedPath),
        fileToken,
      });
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.fsReadTextFile,
    schema: readTextFileRequestSchema,
    context,
    handler: async (event, request) => {
      try {
        const selected = context.selectedFileTokens.get(
          request.payload.fileToken,
        );
        if (!selected || selected.expiresAt <= Date.now()) {
          context.selectedFileTokens.delete(request.payload.fileToken);
          return asFailure(
            'FS/INVALID_TOKEN',
            'The selected file token is invalid or expired.',
            undefined,
            false,
            request.correlationId,
          );
        }

        const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
        if (senderWindowId !== selected.windowId) {
          context.selectedFileTokens.delete(request.payload.fileToken);
          return asFailure(
            'FS/INVALID_TOKEN_SCOPE',
            'Selected file token was issued for a different window.',
            {
              senderWindowId: senderWindowId ?? null,
              tokenWindowId: selected.windowId,
            },
            false,
            request.correlationId,
          );
        }

        context.selectedFileTokens.delete(request.payload.fileToken);

        const content = await fs.readFile(selected.filePath, {
          encoding: request.payload.encoding,
        });

        return asSuccess({ content });
      } catch (error) {
        return asFailure(
          'FS/READ_FAILED',
          'Unable to read requested file.',
          error,
          false,
          request.correlationId,
        );
      }
    },
  });
};
