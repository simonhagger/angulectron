import { isNonEmptyString, toStructuredLogLine } from './common';

describe('isNonEmptyString', () => {
  it('validates non-empty strings', () => {
    expect(isNonEmptyString('ok')).toBe(true);
    expect(isNonEmptyString('')).toBe(false);
  });
});

describe('toStructuredLogLine', () => {
  it('emits structured json log lines with required fields', () => {
    const line = toStructuredLogLine({
      level: 'info',
      component: 'desktop-main',
      event: 'startup',
      version: '1.0.0',
      correlationId: 'corr-123',
      details: { status: 'ok' },
    });

    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.level).toBe('info');
    expect(parsed.component).toBe('desktop-main');
    expect(parsed.event).toBe('startup');
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.correlationId).toBe('corr-123');
    expect(parsed.timestamp).toBeTypeOf('string');
  });
});
