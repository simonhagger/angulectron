import type { DesktopUpdatesApi } from '@electron-foundation/desktop-api';
import {
  CONTRACT_VERSION,
  IPC_CHANNELS,
  updatesCheckRequestSchema,
  updatesCheckResponseSchema,
} from '@electron-foundation/contracts';
import { createCorrelationId, invokeIpc } from '../invoke-client';

export const createUpdatesApi = (): DesktopUpdatesApi => ({
  async check() {
    const correlationId = createCorrelationId();
    const request = updatesCheckRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });
    return invokeIpc(
      IPC_CHANNELS.updatesCheck,
      request,
      correlationId,
      updatesCheckResponseSchema,
    );
  },
});
