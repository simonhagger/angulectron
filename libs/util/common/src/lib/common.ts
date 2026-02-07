export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEvent = {
  level: LogLevel;
  component: string;
  event: string;
  version: string;
  correlationId?: string;
  details?: Record<string, unknown>;
};

export const toStructuredLogLine = (input: LogEvent): string =>
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level: input.level,
    component: input.component,
    event: input.event,
    version: input.version,
    correlationId: input.correlationId,
    details: input.details ?? {},
  });
