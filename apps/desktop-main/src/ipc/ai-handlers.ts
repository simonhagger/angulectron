import { type IpcMain } from 'electron';
import {
  asFailure,
  asSuccess,
  CONTRACT_VERSION,
  IPC_CHANNELS,
  aiCapabilitiesRequestSchema,
  aiCliDetectRequestSchema,
  aiGenerateRequestSchema,
  aiMcpInvokeRequestSchema,
  aiProviderConfigGetRequestSchema,
  aiProviderConfigSaveRequestSchema,
  aiRemoteGenerateRequestSchema,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerValidatedHandler } from './register-validated-handler';
import {
  detectCliAgents,
  invokeCliAgent,
  invokeOpenAiCompatible,
} from '../ai-providers';

const PROVIDER_STORAGE_KEY = 'ai.provider.openai-compatible';

type StoredProviderConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

const readStoredProviderConfig = (
  context: MainIpcContext,
  correlationId: string,
): StoredProviderConfig | null => {
  const stored = context.getStorageGateway().getItem({
    contractVersion: CONTRACT_VERSION,
    correlationId,
    payload: { domain: 'settings', key: PROVIDER_STORAGE_KEY },
  });

  if (!stored.ok || !stored.data.found) {
    return null;
  }

  const value = stored.data.value as Partial<StoredProviderConfig> | undefined;
  if (
    value &&
    typeof value.baseUrl === 'string' &&
    typeof value.model === 'string'
  ) {
    return {
      baseUrl: value.baseUrl,
      model: value.model,
      apiKey:
        typeof value.apiKey === 'string' && value.apiKey.length > 0
          ? value.apiKey
          : undefined,
    };
  }
  return null;
};

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

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.aiProviderConfigGet,
    schema: aiProviderConfigGetRequestSchema,
    context,
    handler: async (_event, request) => {
      const config = readStoredProviderConfig(context, request.correlationId);
      return asSuccess({
        configured: config !== null,
        baseUrl: config?.baseUrl,
        model: config?.model,
        apiKeyPresent: Boolean(config?.apiKey),
      });
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.aiProviderConfigSave,
    schema: aiProviderConfigSaveRequestSchema,
    context,
    handler: async (_event, request) => {
      const existing = readStoredProviderConfig(context, request.correlationId);
      const next: StoredProviderConfig = {
        baseUrl: request.payload.baseUrl,
        model: request.payload.model,
        apiKey:
          request.payload.apiKey && request.payload.apiKey.length > 0
            ? request.payload.apiKey
            : existing?.apiKey,
      };

      const saved = context.getStorageGateway().setItem({
        contractVersion: CONTRACT_VERSION,
        correlationId: request.correlationId,
        payload: {
          domain: 'settings',
          key: PROVIDER_STORAGE_KEY,
          value: next,
          classification: 'sensitive',
        },
      });

      if (!saved.ok) {
        return asFailure(
          'AI/CONFIG_SAVE_FAILED',
          'Failed to persist provider configuration.',
          undefined,
          false,
          request.correlationId,
        );
      }

      context.logEvent(
        'info',
        'ai.provider.config_saved',
        request.correlationId,
        {
          baseUrl: next.baseUrl,
          model: next.model,
          apiKeyPresent: Boolean(next.apiKey),
        },
      );
      return asSuccess({ saved: true });
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.aiCliDetect,
    schema: aiCliDetectRequestSchema,
    context,
    handler: async () => {
      try {
        return asSuccess({ agents: await detectCliAgents() });
      } catch (error) {
        return asFailure(
          'AI/CLI_DETECT_FAILED',
          'CLI agent detection failed.',
          {
            message: error instanceof Error ? error.message : String(error),
          },
        );
      }
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.aiRemoteGenerate,
    schema: aiRemoteGenerateRequestSchema,
    context,
    handler: async (_event, request) => {
      const startedAt = Date.now();

      if (request.payload.source === 'openai-compatible') {
        const config = readStoredProviderConfig(context, request.correlationId);
        if (!config) {
          return asFailure(
            'AI/NOT_CONFIGURED',
            'No OpenAI-compatible provider configured yet.',
            undefined,
            false,
            request.correlationId,
          );
        }
        if (!config.apiKey) {
          return asFailure(
            'AI/API_KEY_MISSING',
            'Provider is configured without an API key.',
            undefined,
            false,
            request.correlationId,
          );
        }

        try {
          const result = await invokeOpenAiCompatible(
            config,
            request.payload.prompt,
            request.payload.maxTokens ?? 512,
          );
          return asSuccess({
            via: result.modelUsed,
            text: result.text,
            elapsedMs: Date.now() - startedAt,
          });
        } catch (error) {
          return asFailure(
            'AI/REMOTE_FAILED',
            error instanceof Error ? error.message : String(error),
            undefined,
            true,
            request.correlationId,
          );
        }
      }

      const agent = request.payload.cliAgent;
      if (!agent) {
        return asFailure(
          'AI/AGENT_REQUIRED',
          'cliAgent is required when source is "cli".',
          undefined,
          false,
          request.correlationId,
        );
      }

      try {
        const result = await invokeCliAgent(agent, request.payload.prompt);
        return asSuccess({
          via: result.via,
          text: result.text,
          elapsedMs: Date.now() - startedAt,
        });
      } catch (error) {
        return asFailure(
          'AI/CLI_FAILED',
          error instanceof Error ? error.message : String(error),
          undefined,
          true,
          request.correlationId,
        );
      }
    },
  });
};
