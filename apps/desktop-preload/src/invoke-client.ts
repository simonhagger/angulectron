import { ipcRenderer } from 'electron';
import { z, type ZodType } from 'zod';
import { toStructuredLogLine } from '@electron-foundation/common';
import {
  asFailure,
  asSuccess,
  CONTRACT_VERSION,
  type DesktopResult,
  type IpcChannel,
} from '@electron-foundation/contracts';

const ipcInvokeTimeoutMs = 10_000;

const logPreloadError = (
  event: string,
  correlationId: string,
  details?: Record<string, unknown>,
) => {
  const line = toStructuredLogLine({
    level: 'error',
    component: 'desktop-preload',
    event,
    version: CONTRACT_VERSION,
    correlationId,
    details,
  });
  console.error(line);
};

const resultSchema = <TPayload>(payloadSchema: ZodType<TPayload>) =>
  z.union([
    z.object({
      ok: z.literal(true),
      data: payloadSchema,
    }),
    z.object({
      ok: z.literal(false),
      error: z.object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
        retryable: z.boolean(),
        correlationId: z.string().optional(),
      }),
    }),
  ]);

export const createCorrelationId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
};

export const invokeIpc = async <TResponse>(
  channel: IpcChannel,
  request: unknown,
  correlationId: string,
  responsePayloadSchema: ZodType<TResponse>,
  timeoutMs = ipcInvokeTimeoutMs,
): Promise<DesktopResult<TResponse>> => {
  try {
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error('IPC invoke timed out')), timeoutMs);
    });

    const response = await Promise.race([
      ipcRenderer.invoke(channel, request),
      timeoutPromise,
    ]);

    const parsed = resultSchema(responsePayloadSchema).safeParse(response);
    if (!parsed.success) {
      logPreloadError('ipc.malformed_response', correlationId, {
        channel,
      });
      return asFailure(
        'IPC_MALFORMED_RESPONSE',
        `Received malformed response from channel: ${channel}`,
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof Error && error.message === 'IPC invoke timed out') {
      logPreloadError('ipc.invoke_timeout', correlationId, {
        channel,
        timeoutMs,
      });
      return asFailure(
        'IPC/TIMEOUT',
        `IPC invoke timed out for channel: ${channel}`,
        { timeoutMs },
        true,
        correlationId,
      );
    }

    logPreloadError('ipc.invoke_failed', correlationId, {
      channel,
      message: error instanceof Error ? error.message : String(error),
    });
    return asFailure(
      'IPC_INVOKE_FAILED',
      `IPC invoke failed for channel: ${channel}`,
      error,
      true,
      correlationId,
    );
  }
};

export const mapResult = <TFrom, TTo>(
  result: DesktopResult<TFrom>,
  mapper: (value: TFrom) => TTo,
): DesktopResult<TTo> => {
  if (result.ok === false) {
    return result as DesktopResult<TTo>;
  }

  return asSuccess(mapper(result.data));
};
