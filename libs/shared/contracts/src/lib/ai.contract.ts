import { z } from 'zod';
import { emptyPayloadSchema, requestEnvelope } from './request-envelope';

export const aiCapabilitiesRequestSchema = requestEnvelope(emptyPayloadSchema);

export const aiGpuSchema = z.object({
  name: z.string(),
  vramMb: z.number().int().nullable(),
  driverVersion: z.string().nullable(),
});

export const aiCapabilitiesResponseSchema = z.object({
  pythonVersion: z.string(),
  platform: z.string(),
  cpuCount: z.number().int().nonnegative(),
  totalMemoryBytes: z.number().int().nonnegative().nullable(),
  nvidiaDriverPresent: z.boolean(),
  gpus: z.array(aiGpuSchema),
  gpuProbeError: z.string().nullable().optional(),
  backends: z
    .object({
      llamaCpp: z.boolean(),
      torch: z.boolean(),
      onnxRuntime: z.boolean(),
      transformers: z.boolean(),
    })
    .strict(),
  modelsDir: z.string(),
  models: z.array(
    z.object({
      fileName: z.string(),
      sizeBytes: z.number().int().nonnegative(),
    }),
  ),
  canRunLocalLlm: z.boolean(),
  recommendedBackend: z.enum(['none', 'llama-cpp']),
  notes: z.array(z.string()),
});

export const aiGenerateRequestSchema = requestEnvelope(
  z
    .object({
      prompt: z.string().min(1).max(4000),
      maxTokens: z.number().int().min(1).max(256).optional(),
      model: z.string().optional(),
    })
    .strict(),
);

export const aiGenerateResponseSchema = z.object({
  available: z.boolean(),
  model: z.string().optional(),
  text: z.string().optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
  reason: z.string().optional(),
  guidance: z.array(z.string()).optional(),
});

export const aiMcpInvokeRequestSchema = requestEnvelope(
  z
    .object({
      method: z.string().min(1),
      params: z.record(z.string(), z.unknown()).optional(),
    })
    .strict(),
);

export const aiMcpInvokeResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.number(), z.string(), z.null()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});

export type AiGpu = z.infer<typeof aiGpuSchema>;
export type AiCapabilitiesRequest = z.infer<typeof aiCapabilitiesRequestSchema>;
export type AiCapabilitiesResponse = z.infer<
  typeof aiCapabilitiesResponseSchema
>;
export type AiGenerateRequest = z.infer<typeof aiGenerateRequestSchema>;
export type AiGenerateResponse = z.infer<typeof aiGenerateResponseSchema>;
export type AiMcpInvokeRequest = z.infer<typeof aiMcpInvokeRequestSchema>;
export type AiMcpInvokeResponse = z.infer<typeof aiMcpInvokeResponseSchema>;
