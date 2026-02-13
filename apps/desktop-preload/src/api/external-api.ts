import type { DesktopExternalApi } from '@electron-foundation/desktop-api';
import {
  type ApiOperationId,
  type ApiOperationParamsById,
  apiGetOperationDiagnosticsRequestSchema,
  apiGetOperationDiagnosticsResponseSchema,
  apiInvokeRequestSchema,
  apiInvokeResponseSchema,
  CONTRACT_VERSION,
  IPC_CHANNELS,
} from '@electron-foundation/contracts';
import { createCorrelationId, invokeIpc } from '../invoke-client';

export const createExternalApi = (): DesktopExternalApi => ({
  async invoke<TOperationId extends ApiOperationId>(
    operationId: TOperationId,
    params?: ApiOperationParamsById[TOperationId],
    options?: { headers?: Record<string, string> },
  ) {
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
