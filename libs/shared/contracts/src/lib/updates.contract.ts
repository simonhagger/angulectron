import { z } from 'zod';
import { requestEnvelope, emptyPayloadSchema } from './request-envelope';

export const updatesCheckRequestSchema = requestEnvelope(emptyPayloadSchema);
export const updatesApplyDemoPatchRequestSchema =
  requestEnvelope(emptyPayloadSchema);

export const updatesCheckResponseSchema = z.object({
  status: z.enum(['available', 'not-available', 'error']),
  message: z.string().optional(),
  source: z.enum(['native', 'demo']).optional(),
  currentVersion: z.string().optional(),
  latestVersion: z.string().optional(),
  demoFilePath: z.string().optional(),
});

export const updatesApplyDemoPatchResponseSchema = z.object({
  applied: z.boolean(),
  status: z.enum(['available', 'not-available', 'error']),
  message: z.string().optional(),
  source: z.enum(['demo']),
  currentVersion: z.string().optional(),
  latestVersion: z.string().optional(),
  demoFilePath: z.string().optional(),
});

export type UpdatesCheckRequest = z.infer<typeof updatesCheckRequestSchema>;
export type UpdatesCheckResponse = z.infer<typeof updatesCheckResponseSchema>;
export type UpdatesApplyDemoPatchRequest = z.infer<
  typeof updatesApplyDemoPatchRequestSchema
>;
export type UpdatesApplyDemoPatchResponse = z.infer<
  typeof updatesApplyDemoPatchResponseSchema
>;
