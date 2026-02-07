import { contextBridge, ipcRenderer } from 'electron';
import { randomUUID } from 'node:crypto';
import { z, type ZodType } from 'zod';
import type { DesktopApi } from '@electron-foundation/desktop-api';
import {
  apiInvokeRequestSchema,
  apiInvokeResponseSchema,
  appVersionRequestSchema,
  appVersionResponseSchema,
  asFailure,
  asSuccess,
  CONTRACT_VERSION,
  handshakeRequestSchema,
  handshakeResponseSchema,
  IPC_CHANNELS,
  openFileDialogRequestSchema,
  openFileDialogResponseSchema,
  readTextFileRequestSchema,
  readTextFileResponseSchema,
  telemetryTrackRequestSchema,
  telemetryTrackResponseSchema,
  updatesCheckRequestSchema,
  updatesCheckResponseSchema,
  type DesktopResult,
} from '@electron-foundation/contracts';

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

const invoke = async <TResponse>(
  channel: string,
  request: unknown,
  correlationId: string,
  responsePayloadSchema: ZodType<TResponse>,
): Promise<DesktopResult<TResponse>> => {
  try {
    const response = await ipcRenderer.invoke(channel, request);
    const parsed = resultSchema(responsePayloadSchema).safeParse(response);

    if (!parsed.success) {
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
    return asFailure(
      'IPC_INVOKE_FAILED',
      `IPC invoke failed for channel: ${channel}`,
      error,
      true,
      correlationId,
    );
  }
};

const mapResult = <TFrom, TTo>(
  result: DesktopResult<TFrom>,
  mapper: (value: TFrom) => TTo,
): DesktopResult<TTo> => {
  if (result.ok === false) {
    return result as DesktopResult<TTo>;
  }

  return asSuccess(mapper(result.data));
};

const desktopApi: DesktopApi = {
  app: {
    async getContractVersion() {
      const correlationId = randomUUID();
      const request = handshakeRequestSchema.parse({
        contractVersion: CONTRACT_VERSION,
        correlationId,
        payload: {},
      });
      const result = await invoke(
        IPC_CHANNELS.handshake,
        request,
        correlationId,
        handshakeResponseSchema,
      );

      return mapResult(result, (value) => value.contractVersion);
    },
    async getVersion() {
      const correlationId = randomUUID();
      const request = appVersionRequestSchema.parse({
        contractVersion: CONTRACT_VERSION,
        correlationId,
        payload: {},
      });
      const result = await invoke(
        IPC_CHANNELS.appGetVersion,
        request,
        correlationId,
        appVersionResponseSchema,
      );

      return mapResult(result, (value) => value.version);
    },
  },
  dialog: {
    async openFile(request = {}) {
      const correlationId = randomUUID();
      const payload = openFileDialogRequestSchema.parse({
        contractVersion: CONTRACT_VERSION,
        correlationId,
        payload: request,
      });

      return invoke(
        IPC_CHANNELS.dialogOpenFile,
        payload,
        correlationId,
        openFileDialogResponseSchema,
      );
    },
  },
  fs: {
    async readTextFile(fileToken) {
      const correlationId = randomUUID();
      const request = readTextFileRequestSchema.parse({
        contractVersion: CONTRACT_VERSION,
        correlationId,
        payload: {
          fileToken,
          encoding: 'utf8',
        },
      });

      const result = await invoke(
        IPC_CHANNELS.fsReadTextFile,
        request,
        correlationId,
        readTextFileResponseSchema,
      );

      return mapResult(result, (value) => value.content);
    },
  },
  api: {
    async invoke(operationId, params) {
      const correlationId = randomUUID();
      const request = apiInvokeRequestSchema.parse({
        contractVersion: CONTRACT_VERSION,
        correlationId,
        payload: {
          operationId,
          params,
        },
      });

      return invoke(
        IPC_CHANNELS.apiInvoke,
        request,
        correlationId,
        apiInvokeResponseSchema,
      );
    },
  },
  updates: {
    async check() {
      const correlationId = randomUUID();
      const request = updatesCheckRequestSchema.parse({
        contractVersion: CONTRACT_VERSION,
        correlationId,
        payload: {},
      });
      return invoke(
        IPC_CHANNELS.updatesCheck,
        request,
        correlationId,
        updatesCheckResponseSchema,
      );
    },
  },
  telemetry: {
    async track(eventName, properties) {
      const correlationId = randomUUID();
      const request = telemetryTrackRequestSchema.parse({
        contractVersion: CONTRACT_VERSION,
        correlationId,
        payload: {
          eventName,
          properties,
        },
      });

      return invoke(
        IPC_CHANNELS.telemetryTrack,
        request,
        correlationId,
        telemetryTrackResponseSchema,
      );
    },
  },
};

contextBridge.exposeInMainWorld('desktop', desktopApi);
