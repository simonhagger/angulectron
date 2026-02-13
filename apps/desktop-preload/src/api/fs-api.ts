import type { DesktopFsApi } from '@electron-foundation/desktop-api';
import {
  CONTRACT_VERSION,
  IPC_CHANNELS,
  readTextFileRequestSchema,
  readTextFileResponseSchema,
} from '@electron-foundation/contracts';
import { createCorrelationId, invokeIpc, mapResult } from '../invoke-client';

export const createFsApi = (): DesktopFsApi => ({
  async readTextFile(fileToken) {
    const correlationId = createCorrelationId();
    const request = readTextFileRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {
        fileToken,
        encoding: 'utf8',
      },
    });

    const result = await invokeIpc(
      IPC_CHANNELS.fsReadTextFile,
      request,
      correlationId,
      readTextFileResponseSchema,
    );

    return mapResult(result, (value) => value.content);
  },
});
