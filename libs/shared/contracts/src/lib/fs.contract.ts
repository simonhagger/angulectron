import { z } from 'zod';
import { requestEnvelope } from './request-envelope';

export const readTextFileRequestSchema = requestEnvelope(
  z
    .object({
      fileToken: z.string().min(1),
      encoding: z.enum(['utf8']).default('utf8'),
    })
    .strict(),
);

export const readTextFileResponseSchema = z.object({
  content: z.string(),
});

export type ReadTextFileRequest = z.infer<typeof readTextFileRequestSchema>;
export type ReadTextFileResponse = z.infer<typeof readTextFileResponseSchema>;
