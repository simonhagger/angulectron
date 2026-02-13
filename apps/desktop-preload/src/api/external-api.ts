import type { DesktopExternalApi } from '@electron-foundation/desktop-api';
import {
  apiGetOperationDiagnosticsRequestSchema,
  apiGetOperationDiagnosticsResponseSchema,
  apiInvokeRequestSchema,
  apiInvokeResponseSchema,
  CONTRACT_VERSION,
  IPC_CHANNELS,
} from '@electron-foundation/contracts';
import { createCorrelationId, invokeIpc } from '../invoke-client';

export const createExternalApi = (): DesktopExternalApi => ({
  async invoke(operationId, params, options) {
    const correlationId = createCorrelationId();
    const request = apiInvokeRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {
        operationId,
        params,
        headers: options?.headers,
      },
    });

    return invokeIpc(
      IPC_CHANNELS.apiInvoke,
      request,
      correlationId,
      apiInvokeResponseSchema,
    );
  },

  async getOperationDiagnostics(operationId) {
    const correlationId = createCorrelationId();
    const request = apiGetOperationDiagnosticsRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {
        operationId,
      },
    });

    return invokeIpc(
      IPC_CHANNELS.apiGetOperationDiagnostics,
      request,
      correlationId,
      apiGetOperationDiagnosticsResponseSchema,
    );
  },
});
