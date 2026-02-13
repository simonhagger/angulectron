import type { DesktopAppApi } from '@electron-foundation/desktop-api';
import {
  appRuntimeVersionsRequestSchema,
  appRuntimeVersionsResponseSchema,
  appVersionRequestSchema,
  appVersionResponseSchema,
  CONTRACT_VERSION,
  handshakeRequestSchema,
  handshakeResponseSchema,
  IPC_CHANNELS,
} from '@electron-foundation/contracts';
import { createCorrelationId, invokeIpc, mapResult } from '../invoke-client';

export const createAppApi = (): DesktopAppApi => ({
  async getContractVersion() {
    const correlationId = createCorrelationId();
    const request = handshakeRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });
    const result = await invokeIpc(
      IPC_CHANNELS.handshake,
      request,
      correlationId,
      handshakeResponseSchema,
    );

    return mapResult(result, (value) => value.contractVersion);
  },

  async getVersion() {
    const correlationId = createCorrelationId();
    const request = appVersionRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });
    const result = await invokeIpc(
      IPC_CHANNELS.appGetVersion,
      request,
      correlationId,
      appVersionResponseSchema,
    );

    return mapResult(result, (value) => value.version);
  },

  async getRuntimeVersions() {
    const correlationId = createCorrelationId();
    const request = appRuntimeVersionsRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });
    return invokeIpc(
      IPC_CHANNELS.appGetRuntimeVersions,
      request,
      correlationId,
      appRuntimeVersionsResponseSchema,
    );
  },
});
