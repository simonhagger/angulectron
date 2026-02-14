import type { DesktopDialogApi } from '@electron-foundation/desktop-api';
import {
  CONTRACT_VERSION,
  IPC_CHANNELS,
  openFileDialogRequestSchema,
  openFileDialogResponseSchema,
} from '@electron-foundation/contracts';
import { createCorrelationId, invokeIpc } from '../invoke-client';

const dialogOpenTimeoutMs = 120_000;

export const createDialogApi = (): DesktopDialogApi => ({
  async openFile(request = {}) {
    const correlationId = createCorrelationId();
    const payload = openFileDialogRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: request,
    });

    return invokeIpc(
      IPC_CHANNELS.dialogOpenFile,
      payload,
      correlationId,
      openFileDialogResponseSchema,
      dialogOpenTimeoutMs,
    );
  },
});
