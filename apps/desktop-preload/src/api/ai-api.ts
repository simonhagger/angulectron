import type { DesktopAiApi } from '@electron-foundation/desktop-api';
import {
  CONTRACT_VERSION,
  IPC_CHANNELS,
  aiCapabilitiesRequestSchema,
  aiCapabilitiesResponseSchema,
  aiCliDetectRequestSchema,
  aiCliDetectResponseSchema,
  aiGenerateRequestSchema,
  aiGenerateResponseSchema,
  aiMcpInvokeRequestSchema,
  aiMcpInvokeResponseSchema,
  aiProviderConfigGetRequestSchema,
  aiProviderConfigGetResponseSchema,
  aiProviderConfigSaveRequestSchema,
  aiProviderConfigSaveResponseSchema,
  aiRemoteGenerateRequestSchema,
  aiRemoteGenerateResponseSchema,
} from '@electron-foundation/contracts';
import { createCorrelationId, invokeIpc } from '../invoke-client';

export const createAiApi = (): DesktopAiApi => ({
  async capabilities() {
    const correlationId = createCorrelationId();
    const request = aiCapabilitiesRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });

    return invokeIpc(
      IPC_CHANNELS.aiCapabilities,
      request,
      correlationId,
      aiCapabilitiesResponseSchema,
      10_000,
    );
  },

  async generate(prompt, maxTokens) {
    const correlationId = createCorrelationId();
    const request = aiGenerateRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: { prompt, ...(maxTokens ? { maxTokens } : {}) },
    });

    return invokeIpc(
      IPC_CHANNELS.aiGenerate,
      request,
      correlationId,
      aiGenerateResponseSchema,
      120_000,
    );
  },

  async mcpInvoke(method, params) {
    const correlationId = createCorrelationId();
    const request = aiMcpInvokeRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: { method, ...(params ? { params } : {}) },
    });

    return invokeIpc(
      IPC_CHANNELS.aiMcpInvoke,
      request,
      correlationId,
      aiMcpInvokeResponseSchema,
      15_000,
    );
  },

  async providerConfigGet() {
    const correlationId = createCorrelationId();
    const request = aiProviderConfigGetRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });

    return invokeIpc(
      IPC_CHANNELS.aiProviderConfigGet,
      request,
      correlationId,
      aiProviderConfigGetResponseSchema,
      10_000,
    );
  },

  async providerConfigSave(config) {
    const correlationId = createCorrelationId();
    const request = aiProviderConfigSaveRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: config,
    });

    return invokeIpc(
      IPC_CHANNELS.aiProviderConfigSave,
      request,
      correlationId,
      aiProviderConfigSaveResponseSchema,
      10_000,
    );
  },

  async cliDetect() {
    const correlationId = createCorrelationId();
    const request = aiCliDetectRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });

    return invokeIpc(
      IPC_CHANNELS.aiCliDetect,
      request,
      correlationId,
      aiCliDetectResponseSchema,
      15_000,
    );
  },

  async remoteGenerate(source, prompt, options) {
    const correlationId = createCorrelationId();
    const request = aiRemoteGenerateRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {
        source,
        prompt,
        ...(options?.maxTokens ? { maxTokens: options.maxTokens } : {}),
        ...(options?.cliAgent ? { cliAgent: options.cliAgent } : {}),
      },
    });

    return invokeIpc(
      IPC_CHANNELS.aiRemoteGenerate,
      request,
      correlationId,
      aiRemoteGenerateResponseSchema,
      150_000,
    );
  },
});
