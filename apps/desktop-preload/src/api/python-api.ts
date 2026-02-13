import type { DesktopPythonApi } from '@electron-foundation/desktop-api';
import {
  CONTRACT_VERSION,
  IPC_CHANNELS,
  pythonInspectPdfRequestSchema,
  pythonInspectPdfResponseSchema,
  pythonProbeRequestSchema,
  pythonProbeResponseSchema,
  pythonStopRequestSchema,
  pythonStopResponseSchema,
} from '@electron-foundation/contracts';
import { createCorrelationId, invokeIpc } from '../invoke-client';

export const createPythonApi = (): DesktopPythonApi => ({
  async probe() {
    const correlationId = createCorrelationId();
    const request = pythonProbeRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });

    return invokeIpc(
      IPC_CHANNELS.pythonProbe,
      request,
      correlationId,
      pythonProbeResponseSchema,
      15_000,
    );
  },

  async inspectPdf(fileToken: string) {
    const correlationId = createCorrelationId();
    const request = pythonInspectPdfRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: { fileToken },
    });

    return invokeIpc(
      IPC_CHANNELS.pythonInspectPdf,
      request,
      correlationId,
      pythonInspectPdfResponseSchema,
      15_000,
    );
  },

  async stop() {
    const correlationId = createCorrelationId();
    const request = pythonStopRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });

    return invokeIpc(
      IPC_CHANNELS.pythonStop,
      request,
      correlationId,
      pythonStopResponseSchema,
    );
  },
});
