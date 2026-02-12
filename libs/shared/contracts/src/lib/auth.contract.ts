import { z } from 'zod';
import { emptyPayloadSchema, requestEnvelope } from './request-envelope';

export const authSessionStateSchema = z.enum([
  'signed-out',
  'signing-in',
  'active',
  'refresh-failed',
]);

export const authSessionSummarySchema = z
  .object({
    state: authSessionStateSchema,
    userId: z.string().min(1).optional(),
    email: z.string().email().optional(),
    name: z.string().min(1).optional(),
    expiresAt: z.string().datetime().optional(),
    scopes: z.array(z.string().min(1)).default([]),
    entitlements: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const authSignInRequestSchema = requestEnvelope(emptyPayloadSchema);
export const authSignInResponseSchema = z
  .object({
    initiated: z.boolean(),
  })
  .strict();

export const authSignOutRequestSchema = requestEnvelope(emptyPayloadSchema);
export const authSignOutResponseSchema = z
  .object({
    signedOut: z.boolean(),
  })
  .strict();

export const authGetSessionSummaryRequestSchema =
  requestEnvelope(emptyPayloadSchema);
export const authGetSessionSummaryResponseSchema = authSessionSummarySchema;

export type AuthSessionState = z.infer<typeof authSessionStateSchema>;
export type AuthSessionSummary = z.infer<typeof authSessionSummarySchema>;
export type AuthSignInRequest = z.infer<typeof authSignInRequestSchema>;
export type AuthSignInResponse = z.infer<typeof authSignInResponseSchema>;
export type AuthSignOutRequest = z.infer<typeof authSignOutRequestSchema>;
export type AuthSignOutResponse = z.infer<typeof authSignOutResponseSchema>;
export type AuthGetSessionSummaryRequest = z.infer<
  typeof authGetSessionSummaryRequestSchema
>;
export type AuthGetSessionSummaryResponse = z.infer<
  typeof authGetSessionSummaryResponseSchema
>;
