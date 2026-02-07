import { z } from 'zod';
import { parseOrFailure } from './contracts';
import { apiInvokeRequestSchema } from './api.contract';
import { readTextFileRequestSchema } from './fs.contract';

describe('parseOrFailure', () => {
  it('should parse valid values', () => {
    const result = parseOrFailure(
      z.object({ name: z.string() }),
      { name: 'ok' },
      'BAD',
      'bad',
    );
    expect(result.ok).toBe(true);
  });

  it('should return failure for invalid values', () => {
    const result = parseOrFailure(
      z.object({ name: z.string() }),
      { name: 10 },
      'BAD',
      'bad',
    );
    expect(result.ok).toBe(false);
  });
});

describe('readTextFileRequestSchema', () => {
  it('accepts token-based payloads', () => {
    const parsed = readTextFileRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-1',
      payload: {
        fileToken: 'token-123',
        encoding: 'utf8',
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects legacy path-based payloads', () => {
    const parsed = readTextFileRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-2',
      payload: {
        path: 'C:\\temp\\foo.txt',
        encoding: 'utf8',
      },
    });

    expect(parsed.success).toBe(false);
  });
});

describe('apiInvokeRequestSchema', () => {
  it('accepts operation-based API calls', () => {
    const parsed = apiInvokeRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-3',
      payload: {
        operationId: 'status.github',
        params: {
          includeMeta: true,
        },
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects empty operation names', () => {
    const parsed = apiInvokeRequestSchema.safeParse({
      contractVersion: '1.0.0',
      correlationId: 'corr-4',
      payload: {
        operationId: '',
      },
    });

    expect(parsed.success).toBe(false);
  });
});
