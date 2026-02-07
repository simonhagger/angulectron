import { z } from 'zod';
import { requestEnvelope } from './request-envelope';

export const storageDomainSchema = z.enum(['settings', 'cache']);
export const storageClassificationSchema = z.enum(['internal', 'sensitive']);
export type StorageClassification = z.infer<typeof storageClassificationSchema>;

export const storageSetRequestSchema = requestEnvelope(
  z
    .object({
      domain: storageDomainSchema,
      key: z.string().min(1).max(256),
      value: z.unknown(),
      classification: storageClassificationSchema.default('internal'),
      ttlSeconds: z.number().int().min(1).max(2_592_000).optional(),
    })
    .strict(),
);

export const storageSetResponseSchema = z.object({
  updated: z.boolean(),
});

export const storageGetRequestSchema = requestEnvelope(
  z
    .object({
      domain: storageDomainSchema,
      key: z.string().min(1).max(256),
    })
    .strict(),
);

export const storageGetResponseSchema = z.object({
  found: z.boolean(),
  value: z.unknown().optional(),
  classification: storageClassificationSchema.optional(),
});

export const storageDeleteRequestSchema = requestEnvelope(
  z
    .object({
      domain: storageDomainSchema,
      key: z.string().min(1).max(256),
    })
    .strict(),
);

export const storageDeleteResponseSchema = z.object({
  deleted: z.boolean(),
});

export const storageClearDomainRequestSchema = requestEnvelope(
  z
    .object({
      domain: storageDomainSchema,
    })
    .strict(),
);

export const storageClearDomainResponseSchema = z.object({
  cleared: z.number().int().min(0),
});

export type StorageSetRequest = z.infer<typeof storageSetRequestSchema>;
export type StorageSetResponse = z.infer<typeof storageSetResponseSchema>;
export type StorageGetRequest = z.infer<typeof storageGetRequestSchema>;
export type StorageGetResponse = z.infer<typeof storageGetResponseSchema>;
export type StorageDeleteRequest = z.infer<typeof storageDeleteRequestSchema>;
export type StorageDeleteResponse = z.infer<typeof storageDeleteResponseSchema>;
export type StorageClearDomainRequest = z.infer<
  typeof storageClearDomainRequestSchema
>;
export type StorageClearDomainResponse = z.infer<
  typeof storageClearDomainResponseSchema
>;
