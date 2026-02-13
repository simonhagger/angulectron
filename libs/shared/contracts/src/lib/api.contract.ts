import { z } from 'zod';
import { requestEnvelope } from './request-envelope';

const apiParamValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export type ApiParamValue = z.infer<typeof apiParamValueSchema>;

const apiHeaderNameSchema = z
  .string()
  .regex(/^x-[a-z0-9-]+$/i, 'Only x-* header names are allowed.');
const apiHeaderValueSchema = z.string().max(512);

export const API_OPERATION_IDS = [
  'status.github',
  'call.secure-endpoint',
] as const;
export const apiOperationIdSchema = z.enum(API_OPERATION_IDS);
export type ApiOperationId = z.infer<typeof apiOperationIdSchema>;

export type ApiOperationParamsById = {
  'status.github': Record<string, ApiParamValue> | undefined;
  'call.secure-endpoint': Record<string, ApiParamValue> | undefined;
};

export type ApiOperationResponseDataById = {
  'status.github': unknown;
  'call.secure-endpoint': unknown;
};

export const apiInvokeRequestSchema = requestEnvelope(
  z
    .object({
      operationId: apiOperationIdSchema,
      params: z.record(z.string(), apiParamValueSchema).optional(),
      headers: z.record(apiHeaderNameSchema, apiHeaderValueSchema).optional(),
    })
    .strict(),
);

export const apiGetOperationDiagnosticsRequestSchema = requestEnvelope(
  z
    .object({
      operationId: apiOperationIdSchema,
    })
    .strict(),
);

const apiAuthTypeSchema = z.enum(['none', 'bearer', 'oidc']);

export const apiGetOperationDiagnosticsResponseSchema = z
  .object({
    operationId: apiOperationIdSchema,
    configured: z.boolean(),
    configurationHint: z.string().optional(),
    method: z.enum(['GET', 'POST']).optional(),
    urlTemplate: z.string().optional(),
    pathPlaceholders: z.array(z.string()),
    claimMap: z.record(z.string(), z.string()),
    authType: apiAuthTypeSchema.optional(),
  })
  .strict();

export const apiInvokeResponseSchema = z.object({
  status: z.number().int().min(100).max(599),
  data: z.unknown(),
  contentType: z.string().optional(),
  requestPath: z.string().min(1).optional(),
});

export type ApiInvokeRequest = z.infer<typeof apiInvokeRequestSchema>;
export type ApiInvokeRequestPayload = ApiInvokeRequest['payload'];
export type ApiGetOperationDiagnosticsRequest = z.infer<
  typeof apiGetOperationDiagnosticsRequestSchema
>;
export type ApiGetOperationDiagnosticsResponse = z.infer<
  typeof apiGetOperationDiagnosticsResponseSchema
>;
export type ApiInvokeResponse = z.infer<typeof apiInvokeResponseSchema>;
