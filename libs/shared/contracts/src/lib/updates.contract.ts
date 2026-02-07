import { z } from 'zod';
import { requestEnvelope, emptyPayloadSchema } from './request-envelope';

export const updatesCheckRequestSchema = requestEnvelope(emptyPayloadSchema);

export const updatesCheckResponseSchema = z.object({
  status: z.enum(['checking', 'available', 'not-available', 'error']),
  message: z.string().optional(),
});

export type UpdatesCheckRequest = z.infer<typeof updatesCheckRequestSchema>;
export type UpdatesCheckResponse = z.infer<typeof updatesCheckResponseSchema>;
