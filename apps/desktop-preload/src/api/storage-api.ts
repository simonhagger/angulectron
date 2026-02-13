import type { DesktopStorageApi } from '@electron-foundation/desktop-api';
import {
  CONTRACT_VERSION,
  IPC_CHANNELS,
  storageClearDomainRequestSchema,
  storageClearDomainResponseSchema,
  storageDeleteRequestSchema,
  storageDeleteResponseSchema,
  storageGetRequestSchema,
  storageGetResponseSchema,
  storageSetRequestSchema,
  storageSetResponseSchema,
} from '@electron-foundation/contracts';
import { createCorrelationId, invokeIpc } from '../invoke-client';

export const createStorageApi = (): DesktopStorageApi => ({
  async setItem(domain, key, value, classification = 'internal', options = {}) {
    const correlationId = createCorrelationId();
    const request = storageSetRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {
        domain,
        key,
        value,
        classification,
        ttlSeconds: options.ttlSeconds,
      },
    });

    return invokeIpc(
      IPC_CHANNELS.storageSetItem,
      request,
      correlationId,
      storageSetResponseSchema,
    );
  },

  async getItem(domain, key) {
    const correlationId = createCorrelationId();
    const request = storageGetRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: { domain, key },
    });

    return invokeIpc(
      IPC_CHANNELS.storageGetItem,
      request,
      correlationId,
      storageGetResponseSchema,
    );
  },

  async deleteItem(domain, key) {
    const correlationId = createCorrelationId();
    const request = storageDeleteRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: { domain, key },
    });

    return invokeIpc(
      IPC_CHANNELS.storageDeleteItem,
      request,
      correlationId,
      storageDeleteResponseSchema,
    );
  },

  async clearDomain(domain) {
    const correlationId = createCorrelationId();
    const request = storageClearDomainRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: { domain },
    });

    return invokeIpc(
      IPC_CHANNELS.storageClearDomain,
      request,
      correlationId,
      storageClearDomainResponseSchema,
    );
  },
});
