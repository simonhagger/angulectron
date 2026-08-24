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

export const aiProviderConfigGetRequestSchema =
  requestEnvelope(emptyPayloadSchema);

export const aiProviderConfigGetResponseSchema = z.object({
  configured: z.boolean(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  apiKeyPresent: z.boolean(),
});

export const aiProviderConfigSaveRequestSchema = requestEnvelope(
  z
    .object({
      baseUrl: z.string().min(1).max(500),
      model: z.string().min(1).max(200),
      apiKey: z.string().max(400).optional(),
    })
    .strict(),
);

export const aiProviderConfigSaveResponseSchema = z.object({
  saved: z.boolean(),
});

export const aiCliAgentSchema = z.object({
  id: z.enum(['claude', 'codex', 'opencode']),
  available: z.boolean(),
  detail: z.string().optional(),
});

export const aiCliDetectRequestSchema = requestEnvelope(emptyPayloadSchema);

export const aiCliDetectResponseSchema = z.object({
  agents: z.array(aiCliAgentSchema),
});

export const aiRemoteGenerateRequestSchema = requestEnvelope(
  z
    .object({
      source: z.enum(['openai-compatible', 'cli']),
      prompt: z.string().min(1).max(4000),
      maxTokens: z.number().int().min(1).max(1024).optional(),
      cliAgent: z.enum(['claude', 'codex', 'opencode']).optional(),
    })
    .strict(),
);

export const aiRemoteGenerateResponseSchema = z.object({
  via: z.string(),
  text: z.string(),
  elapsedMs: z.number().int().nonnegative(),
});

export type AiCliAgent = z.infer<typeof aiCliAgentSchema>;
export type AiProviderConfigGetRequest = z.infer<
  typeof aiProviderConfigGetRequestSchema
>;
export type AiProviderConfigGetResponse = z.infer<
  typeof aiProviderConfigGetResponseSchema
>;
export type AiProviderConfigSaveRequest = z.infer<
  typeof aiProviderConfigSaveRequestSchema
>;
export type AiProviderConfigSaveResponse = z.infer<
  typeof aiProviderConfigSaveResponseSchema
>;
export type AiCliDetectRequest = z.infer<typeof aiCliDetectRequestSchema>;
export type AiCliDetectResponse = z.infer<typeof aiCliDetectResponseSchema>;
export type AiRemoteGenerateRequest = z.infer<
  typeof aiRemoteGenerateRequestSchema
>;
export type AiRemoteGenerateResponse = z.infer<
  typeof aiRemoteGenerateResponseSchema
>;

export type AiGpu = z.infer<typeof aiGpuSchema>;
export type AiCapabilitiesRequest = z.infer<typeof aiCapabilitiesRequestSchema>;
export type AiCapabilitiesResponse = z.infer<
  typeof aiCapabilitiesResponseSchema
>;
export type AiGenerateRequest = z.infer<typeof aiGenerateRequestSchema>;
export type AiGenerateResponse = z.infer<typeof aiGenerateResponseSchema>;
export type AiMcpInvokeRequest = z.infer<typeof aiMcpInvokeRequestSchema>;
export type AiMcpInvokeResponse = z.infer<typeof aiMcpInvokeResponseSchema>;
