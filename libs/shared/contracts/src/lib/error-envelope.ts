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

export const isSuccess = <T>(
  result: unknown,
): result is Extract<DesktopResult<T>, { ok: true }> =>
  typeof result === 'object' &&
  result !== null &&
  'ok' in result &&
  result.ok === true &&
  'data' in result;

export const isFailure = (
  result: unknown,
): result is Extract<DesktopResult<unknown>, { ok: false }> =>
  typeof result === 'object' &&
  result !== null &&
  'ok' in result &&
  result.ok === false &&
  'error' in result &&
  typeof (result as { error?: unknown }).error === 'object' &&
  (result as { error?: unknown }).error !== null;

export const unwrapSuccessData = <T>(
  result: DesktopResult<T>,
): T | undefined => (isSuccess<T>(result) ? result.data : undefined);

export const unwrapFailureError = (
  result: DesktopResult<unknown>,
): ErrorEnvelope | null => (isFailure(result) ? result.error : null);

export const validateResponseEnvelope = <TData>(
  data: unknown,
  schema: z.ZodType<TData>,
): DesktopResult<TData> => {
  if (!schema) {
    return asSuccess(data as TData);
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return asFailure(
      'IPC/RESPONSE_VALIDATION_FAILED',
      'Response data failed envelope validation.',
      parsed.error.flatten(),
      false,
    );
  }

  return asSuccess(parsed.data);
};
