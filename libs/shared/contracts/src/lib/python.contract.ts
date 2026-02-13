import { z } from 'zod';
import { emptyPayloadSchema, requestEnvelope } from './request-envelope';

export const pythonProbeRequestSchema = requestEnvelope(emptyPayloadSchema);
export const pythonInspectPdfRequestSchema = requestEnvelope(
  z
    .object({
      fileToken: z.string().min(1),
    })
    .strict(),
);
export const pythonStopRequestSchema = requestEnvelope(emptyPayloadSchema);

export const pythonProbeHealthSchema = z.object({
  status: z.string(),
  service: z.string(),
  pythonVersion: z.string(),
  pythonExecutable: z.string().optional(),
  pymupdfAvailable: z.boolean(),
  pymupdfVersion: z.string().optional(),
  pymupdfError: z.string().optional(),
});

export const pythonProbeResponseSchema = z.object({
  available: z.boolean(),
  started: z.boolean(),
  running: z.boolean(),
  endpoint: z.string(),
  pid: z.number().int().optional(),
  pythonCommand: z.string().optional(),
  message: z.string().optional(),
  health: pythonProbeHealthSchema.optional(),
});

export const pythonStopResponseSchema = z.object({
  stopped: z.boolean(),
  running: z.boolean(),
  message: z.string().optional(),
});

export const pythonInspectPdfResponseSchema = z.object({
  accepted: z.boolean(),
  fileName: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  headerHex: z.string(),
  pythonVersion: z.string(),
  pythonExecutable: z.string().optional(),
  pymupdfAvailable: z.boolean(),
  pymupdfVersion: z.string().optional(),
  message: z.string().optional(),
});

export type PythonProbeRequest = z.infer<typeof pythonProbeRequestSchema>;
export type PythonProbeResponse = z.infer<typeof pythonProbeResponseSchema>;
export type PythonInspectPdfRequest = z.infer<
  typeof pythonInspectPdfRequestSchema
>;
export type PythonInspectPdfResponse = z.infer<
  typeof pythonInspectPdfResponseSchema
>;
export type PythonStopRequest = z.infer<typeof pythonStopRequestSchema>;
export type PythonStopResponse = z.infer<typeof pythonStopResponseSchema>;
