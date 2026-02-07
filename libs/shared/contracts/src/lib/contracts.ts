import type { ZodType } from 'zod';
import { asFailure, type DesktopResult } from './error-envelope';

export const parseOrFailure = <T>(
  schema: ZodType<T>,
  payload: unknown,
  code: string,
  message: string,
): DesktopResult<T> => {
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return asFailure(code, message, parsed.error.flatten(), false);
  }

  return { ok: true, data: parsed.data };
};
