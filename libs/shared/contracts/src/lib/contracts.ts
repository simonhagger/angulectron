import type { ZodType } from 'zod';
import { asFailure, type DesktopResult } from './error-envelope';

export const parseOrFailure = <T>(
  schema: ZodType<T>,
  payload: unknown,
  code: string,
  message: string,
  options?: { correlationId?: string; retryable?: boolean },
): DesktopResult<T> => {
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return asFailure(
      code,
      message,
      parsed.error.flatten(),
      options?.retryable ?? false,
      options?.correlationId,
    );
  }

  return { ok: true, data: parsed.data };
};
