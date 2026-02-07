import { z } from 'zod';
import { requestEnvelope } from './request-envelope';

export const telemetryTrackRequestSchema = requestEnvelope(
  z
    .object({
      eventName: z.string().min(1),
      properties: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional(),
    })
    .strict(),
);

export const telemetryTrackResponseSchema = z.object({
  accepted: z.boolean(),
});

export type TelemetryTrackRequest = z.infer<typeof telemetryTrackRequestSchema>;
export type TelemetryTrackResponse = z.infer<
  typeof telemetryTrackResponseSchema
>;
