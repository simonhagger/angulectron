import type { DesktopSettingsApi } from '@electron-foundation/desktop-api';
import {
  CONTRACT_VERSION,
  IPC_CHANNELS,
  settingsExportFeatureConfigRequestSchema,
  settingsExportFeatureConfigResponseSchema,
  settingsExportRuntimeConfigRequestSchema,
  settingsExportRuntimeConfigResponseSchema,
  settingsGetRuntimeConfigRequestSchema,
  settingsImportFeatureConfigRequestSchema,
  settingsImportFeatureConfigResponseSchema,
  settingsImportRuntimeConfigRequestSchema,
  settingsImportRuntimeConfigResponseSchema,
  settingsResetFeatureConfigRequestSchema,
  settingsRuntimeConfigStateResponseSchema,
  settingsSaveFeatureConfigRequestSchema,
  type AppFeatureConfig,
  type ApiFeatureConfig,
  type AuthFeatureConfig,
  type RuntimeConfigFeatureKey,
} from '@electron-foundation/contracts';
import { createCorrelationId, invokeIpc } from '../invoke-client';

type RuntimeConfigFeatureConfigByKey = {
  app: AppFeatureConfig;
  auth: AuthFeatureConfig;
  api: ApiFeatureConfig;
};

export const createSettingsApi = (): DesktopSettingsApi => ({
  async getRuntimeConfig() {
    const correlationId = createCorrelationId();
    const request = settingsGetRuntimeConfigRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });

    return invokeIpc(
      IPC_CHANNELS.settingsGetRuntimeConfig,
      request,
      correlationId,
      settingsRuntimeConfigStateResponseSchema,
    );
  },

  async saveFeatureConfig<TFeature extends RuntimeConfigFeatureKey>(
    feature: TFeature,
    config: RuntimeConfigFeatureConfigByKey[TFeature],
  ) {
    const correlationId = createCorrelationId();
    const request = settingsSaveFeatureConfigRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: { feature, config },
    });

    return invokeIpc(
      IPC_CHANNELS.settingsSaveFeatureConfig,
      request,
      correlationId,
      settingsRuntimeConfigStateResponseSchema,
    );
  },

  async resetFeatureConfig(feature) {
    const correlationId = createCorrelationId();
    const request = settingsResetFeatureConfigRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: { feature },
    });

    return invokeIpc(
      IPC_CHANNELS.settingsResetFeatureConfig,
      request,
      correlationId,
      settingsRuntimeConfigStateResponseSchema,
    );
  },

  async importFeatureConfig(feature) {
    const correlationId = createCorrelationId();
    const request = settingsImportFeatureConfigRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: { feature },
    });

    return invokeIpc(
      IPC_CHANNELS.settingsImportFeatureConfig,
      request,
      correlationId,
      settingsImportFeatureConfigResponseSchema,
      120_000,
    );
  },

  async exportFeatureConfig(feature) {
    const correlationId = createCorrelationId();
    const request = settingsExportFeatureConfigRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: { feature },
    });

    return invokeIpc(
      IPC_CHANNELS.settingsExportFeatureConfig,
      request,
      correlationId,
      settingsExportFeatureConfigResponseSchema,
      120_000,
    );
  },

  async importRuntimeConfig() {
    const correlationId = createCorrelationId();
    const request = settingsImportRuntimeConfigRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });

    return invokeIpc(
      IPC_CHANNELS.settingsImportRuntimeConfig,
      request,
      correlationId,
      settingsImportRuntimeConfigResponseSchema,
      120_000,
    );
  },

  async exportRuntimeConfig() {
    const correlationId = createCorrelationId();
    const request = settingsExportRuntimeConfigRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });

    return invokeIpc(
      IPC_CHANNELS.settingsExportRuntimeConfig,
      request,
      correlationId,
      settingsExportRuntimeConfigResponseSchema,
      120_000,
    );
  },
});
