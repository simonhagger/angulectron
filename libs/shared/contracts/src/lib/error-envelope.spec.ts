import { z } from 'zod';
import {
  asFailure,
  asSuccess,
  isFailure,
  isSuccess,
  unwrapFailureError,
  unwrapSuccessData,
  validateResponseEnvelope,
} from './error-envelope';

describe('error envelope guards and helpers', () => {
  it('classifies success and failure envelopes', () => {
    const success = asSuccess({ value: 1 });
    const failure = asFailure('TEST/CODE', 'failed');

    expect(isSuccess(success)).toBe(true);
    expect(isSuccess<{ value: number }>(failure)).toBe(false);
    expect(isFailure(success)).toBe(false);
    expect(isFailure(failure)).toBe(true);
    expect(isFailure(null)).toBe(false);
    expect(isFailure('nope')).toBe(false);
    expect(isFailure({ ok: false })).toBe(false);
  });

  it('narrows unwrapped values via type guards', () => {
    const success = asSuccess(42);
    if (isSuccess<number>(success)) {
      expect(success.data).toBe(42);
    } else {
      fail('expected success');
    }

    const failure = asFailure(
      'TEST/CODE',
      'boom',
      { reason: 'x' },
      true,
      'corr-1',
    );
    if (isFailure(failure)) {
      expect(failure.error.code).toBe('TEST/CODE');
      expect(failure.error.retryable).toBe(true);
      expect(failure.error.correlationId).toBe('corr-1');
    } else {
      fail('expected failure');
    }
  });

  it('unwraps success data and returns undefined for failures', () => {
    expect(unwrapSuccessData(asSuccess('data'))).toBe('data');
    expect(unwrapSuccessData(asFailure('TEST/CODE', 'boom'))).toBeUndefined();
  });

  it('unwraps failure error and returns null for successes', () => {
    const error = unwrapFailureError(asFailure('TEST/CODE', 'boom'));
    expect(error?.code).toBe('TEST/CODE');
    expect(unwrapFailureError(asSuccess('data'))).toBeNull();
  });
});

describe('validateResponseEnvelope', () => {
  const schema = z.object({ id: z.string() });

  it('returns parsed data on valid payloads', () => {
    const result = validateResponseEnvelope<{ id: string }>(
      { id: 'a', extra: true },
      schema,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ id: 'a' });
    }
  });

  it('returns a typed validation failure on invalid payloads', () => {
    const result = validateResponseEnvelope<{ id: string }>({ id: 7 }, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('IPC/RESPONSE_VALIDATION_FAILED');
      expect(result.error.retryable).toBe(false);
      expect(result.error.details).toBeDefined();
    }
  });

  it('passes data through when no schema is provided', () => {
    const result = validateResponseEnvelope('raw' as unknown, undefined);
    expect(result.ok).toBe(true);
  });
});
