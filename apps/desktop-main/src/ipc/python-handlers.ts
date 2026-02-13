import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BrowserWindow, type IpcMain, type IpcMainInvokeEvent } from 'electron';
import {
  asFailure,
  asSuccess,
  IPC_CHANNELS,
  pythonInspectPdfRequestSchema,
  pythonProbeRequestSchema,
  pythonStopRequestSchema,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerValidatedHandler } from './register-validated-handler';

export const registerPythonIpcHandlers = (
  ipcMain: IpcMain,
  context: MainIpcContext,
) => {
  const resolveFileTokenPath = async (
    event: IpcMainInvokeEvent,
    fileToken: string,
    correlationId?: string,
  ) => {
    const selected = context.selectedFileTokens.get(fileToken);
    if (!selected || selected.expiresAt <= Date.now()) {
      context.selectedFileTokens.delete(fileToken);
      return asFailure(
        'FS/INVALID_TOKEN',
        'The selected file token is invalid or expired.',
        undefined,
        false,
        correlationId,
      );
    }

    const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
    if (senderWindowId !== selected.windowId) {
      context.selectedFileTokens.delete(fileToken);
      return asFailure(
        'FS/INVALID_TOKEN_SCOPE',
        'Selected file token was issued for a different window.',
        {
          senderWindowId: senderWindowId ?? null,
          tokenWindowId: selected.windowId,
        },
        false,
        correlationId,
      );
    }

    context.selectedFileTokens.delete(fileToken);
    return asSuccess({ path: selected.filePath });
  };

  const looksLikePdf = async (filePath: string) => {
    const file = await fs.open(filePath, 'r');
    try {
      const header = Buffer.alloc(5);
      const readResult = await file.read(header, 0, header.length, 0);
      const bytesRead = readResult.bytesRead;
      const headerSlice = header.subarray(0, bytesRead);
      return {
        valid: headerSlice.toString('ascii') === '%PDF-',
        headerHex: headerSlice.toString('hex'),
      };
    } finally {
      await file.close();
    }
  };

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.pythonProbe,
    schema: pythonProbeRequestSchema,
    context,
    handler: async () => {
      const sidecar = context.getPythonSidecar();
      if (!sidecar) {
        return asSuccess({
          available: false,
          started: false,
          running: false,
          endpoint: 'http://127.0.0.1:43124/health',
          message: 'Python sidecar is not configured.',
        });
      }

      return asSuccess(await sidecar.probe());
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.pythonInspectPdf,
    schema: pythonInspectPdfRequestSchema,
    context,
    handler: async (event, request) => {
      const sidecar = context.getPythonSidecar();
      if (!sidecar) {
        return asFailure(
          'PYTHON/UNAVAILABLE',
          'Python sidecar is not configured.',
          undefined,
          false,
          request.correlationId,
        );
      }

      const resolved = await resolveFileTokenPath(
        event,
        request.payload.fileToken,
        request.correlationId,
      );
      if (!resolved.ok) {
        return resolved;
      }

      const filePath = resolved.data.path;
      if (path.extname(filePath).toLowerCase() !== '.pdf') {
        return asFailure(
          'PYTHON/UNSUPPORTED_FILE_TYPE',
          'Only PDF files are supported for this operation.',
          { fileName: path.basename(filePath) },
          false,
          request.correlationId,
        );
      }

      const header = await looksLikePdf(filePath);
      if (!header.valid) {
        return asFailure(
          'PYTHON/FILE_SIGNATURE_MISMATCH',
          'Selected file does not match expected PDF signature.',
          {
            fileName: path.basename(filePath),
            headerHex: header.headerHex,
          },
          false,
          request.correlationId,
        );
      }

      try {
        const diagnostics = await sidecar.inspectPdf(filePath);
        return asSuccess(diagnostics);
      } catch (error) {
        return asFailure(
          'PYTHON/INSPECT_FAILED',
          'Python sidecar failed to inspect selected PDF.',
          {
            fileName: path.basename(filePath),
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
    channel: IPC_CHANNELS.pythonStop,
    schema: pythonStopRequestSchema,
    context,
    handler: async () => {
      const sidecar = context.getPythonSidecar();
      if (!sidecar) {
        return asSuccess({
          stopped: false,
          running: false,
          message: 'Python sidecar is not configured.',
        });
      }

      return asSuccess(await sidecar.stop());
    },
  });
};
