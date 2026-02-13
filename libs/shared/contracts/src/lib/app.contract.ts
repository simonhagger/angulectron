import { z } from 'zod';
import { contractVersionSchema } from './contract-version';
import { requestEnvelope, emptyPayloadSchema } from './request-envelope';

export const handshakeRequestSchema = requestEnvelope(emptyPayloadSchema);
export const handshakeResponseSchema = z.object({
  contractVersion: contractVersionSchema,
});

export const appVersionRequestSchema = requestEnvelope(emptyPayloadSchema);
export const appVersionResponseSchema = z.object({
  version: z.string().min(1),
});

export const appRuntimeVersionsRequestSchema =
  requestEnvelope(emptyPayloadSchema);
export const appRuntimeVersionsResponseSchema = z
  .object({
    electron: z.string().min(1),
    node: z.string().min(1),
    chrome: z.string().min(1),
    appEnvironment: z.enum(['development', 'staging', 'production']),
  })
  .strict();

export type HandshakeRequest = z.infer<typeof handshakeRequestSchema>;
export type HandshakeResponse = z.infer<typeof handshakeResponseSchema>;
export type AppVersionRequest = z.infer<typeof appVersionRequestSchema>;
export type AppVersionResponse = z.infer<typeof appVersionResponseSchema>;
export type AppRuntimeVersionsRequest = z.infer<
  typeof appRuntimeVersionsRequestSchema
>;
export type AppRuntimeVersionsResponse = z.infer<
  typeof appRuntimeVersionsResponseSchema
>;
