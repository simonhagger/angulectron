import { type IpcMain } from 'electron';
import {
  asFailure,
  asSuccess,
  IPC_CHANNELS,
  aiCapabilitiesRequestSchema,
  aiGenerateRequestSchema,
  aiMcpInvokeRequestSchema,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerValidatedHandler } from './register-validated-handler';

export const registerAiIpcHandlers = (
  ipcMain: IpcMain,
  context: MainIpcContext,
) => {
  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.aiCapabilities,
    schema: aiCapabilitiesRequestSchema,
    context,
    handler: async () => {
      const sidecar = context.getPythonSidecar();
      if (!sidecar) {
        return asFailure(
          'AI/UNAVAILABLE',
          'Python sidecar is not configured.',
          undefined,
          false,
        );
      }

      try {
        return asSuccess(await sidecar.aiCapabilities());
      } catch (error) {
        return asFailure(
          'AI/CAPABILITIES_FAILED',
          'Failed to probe AI capabilities.',
          {
            message: error instanceof Error ? error.message : String(error),
          },
          false,
        );
      }
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.aiGenerate,
    schema: aiGenerateRequestSchema,
    context,
    handler: async (_event, request) => {
      const sidecar = context.getPythonSidecar();
      if (!sidecar) {
        return asFailure(
          'AI/UNAVAILABLE',
          'Python sidecar is not configured.',
          undefined,
          false,
          request.correlationId,
        );
      }

      try {
        const result = await sidecar.aiGenerate(
          request.payload.prompt,
          request.payload.maxTokens ?? 128,
        );
        return asSuccess(result);
      } catch (error) {
        return asFailure(
          'AI/GENERATE_FAILED',
          'Local generation failed.',
          {
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
    channel: IPC_CHANNELS.aiMcpInvoke,
    schema: aiMcpInvokeRequestSchema,
    context,
    handler: async (_event, request) => {
      const sidecar = context.getPythonSidecar();
      if (!sidecar) {
        return asFailure(
          'AI/UNAVAILABLE',
          'Python sidecar is not configured.',
          undefined,
          false,
          request.correlationId,
        );
      }

      try {
        return asSuccess(
          await sidecar.aiMcpInvoke(
            request.payload.method,
            request.payload.params,
          ),
        );
      } catch (error) {
        return asFailure(
          'AI/MCP_FAILED',
          'MCP request to sidecar failed.',
          {
            message: error instanceof Error ? error.message : String(error),
          },
          false,
          request.correlationId,
        );
      }
    },
  });
};
