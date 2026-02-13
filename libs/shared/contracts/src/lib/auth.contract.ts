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

export const authSignOutModeSchema = z.enum(['local', 'global']);

export const authSignOutRequestPayloadSchema = z
  .object({
    mode: authSignOutModeSchema.default('local'),
  })
  .strict();

export const authSignOutRequestSchema = requestEnvelope(
  authSignOutRequestPayloadSchema,
);
export const authSignOutResponseSchema = z
  .object({
    signedOut: z.boolean(),
    mode: authSignOutModeSchema,
    refreshTokenRevoked: z.boolean().default(false),
    providerLogoutSupported: z.boolean().default(false),
    providerLogoutInitiated: z.boolean().default(false),
  })
  .strict();

export const authGetSessionSummaryRequestSchema =
  requestEnvelope(emptyPayloadSchema);
export const authGetSessionSummaryResponseSchema = authSessionSummarySchema;

const authTokenAudienceSchema = z.union([
  z.string().min(1),
  z.array(z.string().min(1)),
]);

const authTokenClaimsSchema = z
  .object({
    iss: z.string().min(1).optional(),
    sub: z.string().min(1).optional(),
    aud: authTokenAudienceSchema.optional(),
    azp: z.string().min(1).optional(),
    scope: z.string().min(1).optional(),
    exp: z.number().int().optional(),
    iat: z.number().int().optional(),
    token_use: z.string().min(1).optional(),
  })
  .strict();

const authTokenDiagnosticSchema = z
  .object({
    present: z.boolean(),
    format: z.enum(['absent', 'jwt', 'opaque']),
    claims: authTokenClaimsSchema.nullable(),
  })
  .strict();

export const authGetTokenDiagnosticsRequestSchema =
  requestEnvelope(emptyPayloadSchema);
export const authGetTokenDiagnosticsResponseSchema = z
  .object({
    sessionState: authSessionStateSchema,
    bearerSource: z.enum(['access_token', 'id_token']),
    expectedAudience: z.string().min(1).optional(),
    accessToken: authTokenDiagnosticSchema,
    idToken: authTokenDiagnosticSchema,
  })
  .strict();

export type AuthSessionState = z.infer<typeof authSessionStateSchema>;
export type AuthSessionSummary = z.infer<typeof authSessionSummarySchema>;
export type AuthSignInRequest = z.infer<typeof authSignInRequestSchema>;
export type AuthSignInResponse = z.infer<typeof authSignInResponseSchema>;
export type AuthSignOutMode = z.infer<typeof authSignOutModeSchema>;
export type AuthSignOutRequestPayload = z.infer<
  typeof authSignOutRequestPayloadSchema
>;
export type AuthSignOutRequest = z.infer<typeof authSignOutRequestSchema>;
export type AuthSignOutResponse = z.infer<typeof authSignOutResponseSchema>;
export type AuthGetSessionSummaryRequest = z.infer<
  typeof authGetSessionSummaryRequestSchema
>;
export type AuthGetSessionSummaryResponse = z.infer<
  typeof authGetSessionSummaryResponseSchema
>;
export type AuthGetTokenDiagnosticsRequest = z.infer<
  typeof authGetTokenDiagnosticsRequestSchema
>;
export type AuthGetTokenDiagnosticsResponse = z.infer<
  typeof authGetTokenDiagnosticsResponseSchema
>;
