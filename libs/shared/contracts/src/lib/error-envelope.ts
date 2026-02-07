import { z } from 'zod';

export const errorEnvelopeSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
  retryable: z.boolean(),
  correlationId: z.string().min(1).max(128).optional(),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export type DesktopResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ErrorEnvelope;
    };

export const asSuccess = <T>(data: T): DesktopResult<T> => ({ ok: true, data });

export const asFailure = (
  code: string,
  message: string,
  details?: unknown,
  retryable = false,
  correlationId?: string,
): DesktopResult<never> => ({
  ok: false,
  error: {
    code,
    message,
    details,
    retryable,
    correlationId,
  },
});
