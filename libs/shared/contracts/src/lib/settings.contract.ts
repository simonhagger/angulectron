import { z } from 'zod';
import { emptyPayloadSchema, requestEnvelope } from './request-envelope';

export const runtimeConfigFeatureKeySchema = z.enum(['app', 'auth', 'api']);

export const appFeatureConfigSchema = z
  .object({
    // Legacy fields retained for backward compatibility with early settings JSON.
    secureEndpointUrlTemplate: z.string().trim().min(1).optional(),
    secureEndpointClaimMap: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export const apiFeatureConfigSchema = z
  .object({
    secureEndpointUrlTemplate: z.string().trim().min(1).optional(),
    secureEndpointClaimMap: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export const authFeatureConfigSchema = z
  .object({
    issuer: z.string().trim().min(1).optional(),
    clientId: z.string().trim().min(1).optional(),
    redirectUri: z.string().trim().min(1).optional(),
    scopes: z.string().trim().min(1).optional(),
    audience: z.string().trim().min(1).optional(),
    sendAudienceInAuthorize: z.boolean().optional(),
    apiBearerTokenSource: z.enum(['access_token', 'id_token']).optional(),
    allowedSignOutOrigins: z.string().trim().min(1).optional(),
  })
  .strict();

export const runtimeConfigDocumentSchema = z
  .object({
    version: z.literal(1),
    app: appFeatureConfigSchema.optional(),
    auth: authFeatureConfigSchema.optional(),
    api: apiFeatureConfigSchema.optional(),
  })
  .strict();

const saveFeaturePayloadSchema = z.discriminatedUnion('feature', [
  z
    .object({
      feature: z.literal('app'),
      config: appFeatureConfigSchema,
    })
    .strict(),
  z
    .object({
      feature: z.literal('auth'),
      config: authFeatureConfigSchema,
    })
    .strict(),
  z
    .object({
      feature: z.literal('api'),
      config: apiFeatureConfigSchema,
    })
    .strict(),
]);

const resetFeaturePayloadSchema = z
  .object({
    feature: runtimeConfigFeatureKeySchema,
  })
  .strict();

export const settingsGetRuntimeConfigRequestSchema =
  requestEnvelope(emptyPayloadSchema);

export const settingsRuntimeConfigStateResponseSchema = z
  .object({
    sourcePath: z.string(),
    exists: z.boolean(),
    config: runtimeConfigDocumentSchema,
  })
  .strict();

export const settingsSaveFeatureConfigRequestSchema = requestEnvelope(
  saveFeaturePayloadSchema,
);

export const settingsSaveFeatureConfigResponseSchema =
  settingsRuntimeConfigStateResponseSchema;

export const settingsResetFeatureConfigRequestSchema = requestEnvelope(
  resetFeaturePayloadSchema,
);

export const settingsResetFeatureConfigResponseSchema =
  settingsRuntimeConfigStateResponseSchema;

export const settingsImportFeatureConfigRequestSchema = requestEnvelope(
  resetFeaturePayloadSchema,
);

export const settingsImportFeatureConfigResponseSchema = z
  .object({
    canceled: z.boolean(),
    imported: z.boolean(),
    feature: runtimeConfigFeatureKeySchema,
    sourcePath: z.string().optional(),
    config: runtimeConfigDocumentSchema.optional(),
  })
  .strict();

export const settingsExportFeatureConfigRequestSchema = requestEnvelope(
  resetFeaturePayloadSchema,
);

export const settingsExportFeatureConfigResponseSchema = z
  .object({
    canceled: z.boolean(),
    exported: z.boolean(),
    feature: runtimeConfigFeatureKeySchema,
    targetPath: z.string().optional(),
  })
  .strict();

export const settingsImportRuntimeConfigRequestSchema =
  requestEnvelope(emptyPayloadSchema);

export const settingsImportRuntimeConfigResponseSchema = z
  .object({
    canceled: z.boolean(),
    imported: z.boolean(),
    sourcePath: z.string().optional(),
    config: runtimeConfigDocumentSchema.optional(),
  })
  .strict();

export const settingsExportRuntimeConfigRequestSchema =
  requestEnvelope(emptyPayloadSchema);

export const settingsExportRuntimeConfigResponseSchema = z
  .object({
    canceled: z.boolean(),
    exported: z.boolean(),
    targetPath: z.string().optional(),
  })
  .strict();

export type RuntimeConfigFeatureKey = z.infer<
  typeof runtimeConfigFeatureKeySchema
>;
export type AppFeatureConfig = z.infer<typeof appFeatureConfigSchema>;
export type AuthFeatureConfig = z.infer<typeof authFeatureConfigSchema>;
export type ApiFeatureConfig = z.infer<typeof apiFeatureConfigSchema>;
export type RuntimeConfigDocument = z.infer<typeof runtimeConfigDocumentSchema>;

export type SettingsGetRuntimeConfigRequest = z.infer<
  typeof settingsGetRuntimeConfigRequestSchema
>;
export type SettingsRuntimeConfigStateResponse = z.infer<
  typeof settingsRuntimeConfigStateResponseSchema
>;
export type SettingsSaveFeatureConfigRequest = z.infer<
  typeof settingsSaveFeatureConfigRequestSchema
>;
export type SettingsSaveFeatureConfigResponse = z.infer<
  typeof settingsSaveFeatureConfigResponseSchema
>;
export type SettingsResetFeatureConfigRequest = z.infer<
  typeof settingsResetFeatureConfigRequestSchema
>;
export type SettingsResetFeatureConfigResponse = z.infer<
  typeof settingsResetFeatureConfigResponseSchema
>;
export type SettingsImportFeatureConfigRequest = z.infer<
  typeof settingsImportFeatureConfigRequestSchema
>;
export type SettingsImportFeatureConfigResponse = z.infer<
  typeof settingsImportFeatureConfigResponseSchema
>;
export type SettingsExportFeatureConfigRequest = z.infer<
  typeof settingsExportFeatureConfigRequestSchema
>;
export type SettingsExportFeatureConfigResponse = z.infer<
  typeof settingsExportFeatureConfigResponseSchema
>;
export type SettingsImportRuntimeConfigRequest = z.infer<
  typeof settingsImportRuntimeConfigRequestSchema
>;
export type SettingsImportRuntimeConfigResponse = z.infer<
  typeof settingsImportRuntimeConfigResponseSchema
>;
export type SettingsExportRuntimeConfigRequest = z.infer<
  typeof settingsExportRuntimeConfigRequestSchema
>;
export type SettingsExportRuntimeConfigResponse = z.infer<
  typeof settingsExportRuntimeConfigResponseSchema
>;
