import { z } from 'zod';

export const CONTRACT_VERSION = '1.0.0' as const;

export const contractVersionSchema = z.literal(CONTRACT_VERSION);

export type ContractVersion = z.infer<typeof contractVersionSchema>;
