import { z } from 'zod';
import { contractVersionSchema } from './contract-version';

export const requestEnvelope = <TPayload extends z.ZodTypeAny>(
  payload: TPayload,
) =>
  z.object({
    contractVersion: contractVersionSchema,
    correlationId: z.string().min(1).max(128),
    payload,
  });

export const emptyPayloadSchema = z.object({}).strict();
