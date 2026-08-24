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

export const wordCount = (text: string): number =>
  text
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0).length;

export const paragraphCount = (text: string): number =>
  text.split(/\n[\n]/g).filter((s) => s.trim().length > 0).length;

export const truncate = (text: string, maxChars: number): string => {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
};

export const normalizeWhitespace = (text: string): string =>
  text.replace(/\s+/g, ' ').trim();

export const detectLanguage = (text: string): 'en' | 'unknown' => {
  const englishWords =
    /\\b(the|and|or|but|if|then|else|for|while|return|var|let|const|function|class|import|from|as)\\b/i;
  if (englishWords.test(text)) return 'en';
  return 'unknown';
};
