import { z } from 'zod';
import { requestEnvelope } from './request-envelope';

const apiParamValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const API_OPERATION_IDS = ['status.github'] as const;
export const apiOperationIdSchema = z.enum(API_OPERATION_IDS);
export type ApiOperationId = z.infer<typeof apiOperationIdSchema>;

export const apiInvokeRequestSchema = requestEnvelope(
  z
    .object({
      operationId: apiOperationIdSchema,
      params: z.record(z.string(), apiParamValueSchema).optional(),
    })
    .strict(),
);

export const apiInvokeResponseSchema = z.object({
  status: z.number().int().min(100).max(599),
  data: z.unknown(),
  contentType: z.string().optional(),
});

export type ApiInvokeRequest = z.infer<typeof apiInvokeRequestSchema>;
export type ApiInvokeResponse = z.infer<typeof apiInvokeResponseSchema>;
