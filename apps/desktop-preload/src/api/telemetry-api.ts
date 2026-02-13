import type { DesktopTelemetryApi } from '@electron-foundation/desktop-api';
import {
  CONTRACT_VERSION,
  IPC_CHANNELS,
  telemetryTrackRequestSchema,
  telemetryTrackResponseSchema,
} from '@electron-foundation/contracts';
import { createCorrelationId, invokeIpc } from '../invoke-client';

export const createTelemetryApi = (): DesktopTelemetryApi => ({
  async track(eventName, properties) {
    const correlationId = createCorrelationId();
    const request = telemetryTrackRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {
        eventName,
        properties,
      },
    });

    return invokeIpc(
      IPC_CHANNELS.telemetryTrack,
      request,
      correlationId,
      telemetryTrackResponseSchema,
    );
  },
});
