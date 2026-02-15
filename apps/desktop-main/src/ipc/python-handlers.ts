import { type IpcMain } from 'electron';
import {
  asFailure,
  asSuccess,
  IPC_CHANNELS,
  pythonInspectPdfRequestSchema,
  pythonProbeRequestSchema,
  pythonStopRequestSchema,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { consumeSelectedFileToken } from './consume-selected-file-token';
import { evaluateFileIngressPolicy } from './file-ingress-policy';
import { registerValidatedHandler } from './register-validated-handler';

export const registerPythonIpcHandlers = (
  ipcMain: IpcMain,
  context: MainIpcContext,
) => {
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
        'pdfInspect',
      );
      if (policy.kind !== 'ok') {
        context.logEvent(
          'warn',
          'security.file_ingress_rejected',
          request.correlationId,
          {
            channel: IPC_CHANNELS.pythonInspectPdf,
            policy: 'pdfInspect',
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
            'PYTHON/UNSUPPORTED_FILE_TYPE',
            'Only PDF files are supported for this operation.',
            {
              fileName: policy.fileName,
              extension: policy.extension,
            },
            false,
            request.correlationId,
          );
        }

        return asFailure(
          'PYTHON/FILE_SIGNATURE_MISMATCH',
          'Selected file does not match expected PDF signature.',
          {
            fileName: policy.fileName,
            headerHex: policy.headerHex,
            expectedHex: policy.expectedHex,
          },
          false,
          request.correlationId,
        );
      }

      try {
        const diagnostics = await sidecar.inspectPdf(consumed.data.filePath);
        return asSuccess(diagnostics);
      } catch (error) {
        return asFailure(
          'PYTHON/INSPECT_FAILED',
          'Python sidecar failed to inspect selected PDF.',
          {
            fileName: consumed.data.fileName,
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
