import type { DesktopAiApi } from '@electron-foundation/desktop-api';
import {
  CONTRACT_VERSION,
  IPC_CHANNELS,
  aiCapabilitiesRequestSchema,
  aiCapabilitiesResponseSchema,
  aiGenerateRequestSchema,
  aiGenerateResponseSchema,
  aiMcpInvokeRequestSchema,
  aiMcpInvokeResponseSchema,
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
});
