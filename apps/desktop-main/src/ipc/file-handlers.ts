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
import { consumeSelectedFileToken } from './consume-selected-file-token';
import { evaluateFileIngressPolicy } from './file-ingress-policy';
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
        const consumed = consumeSelectedFileToken(
          event,
          request.payload.fileToken,
          context,
          request.correlationId,
        );
        if (!consumed.ok) {
          return consumed;
        }

        const policy = await evaluateFileIngressPolicy(
          consumed.data.filePath,
          'textRead',
        );
        if (policy.kind !== 'ok') {
          context.logEvent(
            'warn',
            'security.file_ingress_rejected',
            request.correlationId,
            {
              channel: IPC_CHANNELS.fsReadTextFile,
              policy: 'textRead',
              reason: policy.kind,
              fileName: policy.fileName,
              ...(policy.kind === 'unsupported-extension'
                ? {
                    extension: policy.extension,
                    allowedExtensions: policy.allowedExtensions,
                  }
                : {
                    headerHex: policy.headerHex,
                    expectedHex: policy.expectedHex,
                  }),
            },
          );
          if (policy.kind === 'unsupported-extension') {
            return asFailure(
              'FS/UNSUPPORTED_FILE_TYPE',
              'Selected file type is not supported for text read.',
              {
                fileName: policy.fileName,
                extension: policy.extension,
                allowedExtensions: policy.allowedExtensions,
              },
              false,
              request.correlationId,
            );
          }

          return asFailure(
            'FS/FILE_SIGNATURE_MISMATCH',
            'Selected file signature did not match expected content.',
            {
              fileName: policy.fileName,
              headerHex: policy.headerHex,
              expectedHex: policy.expectedHex,
            },
            false,
            request.correlationId,
          );
        }

        const content = await fs.readFile(consumed.data.filePath, {
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
