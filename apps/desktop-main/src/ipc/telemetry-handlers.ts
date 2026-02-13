import type { IpcMain } from 'electron';
import {
  asSuccess,
  IPC_CHANNELS,
  telemetryTrackRequestSchema,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerValidatedHandler } from './register-validated-handler';

const redactTelemetryProperties = (
  properties: Record<string, string | number | boolean> | undefined,
): Record<string, string | number | boolean> => {
  if (!properties) {
    return {};
  }

  const sensitiveKeyPattern =
    /token|secret|password|credential|api[-_]?key|auth/i;
  const redacted: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(properties)) {
    redacted[key] = sensitiveKeyPattern.test(key) ? '[REDACTED]' : value;
  }

  return redacted;
};

export const registerTelemetryIpcHandlers = (
  ipcMain: IpcMain,
  context: MainIpcContext,
) => {
  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.telemetryTrack,
    schema: telemetryTrackRequestSchema,
    context,
    handler: (_event, request) => {
      context.logEvent('info', 'telemetry.track', request.correlationId, {
        eventName: request.payload.eventName,
        properties: redactTelemetryProperties(request.payload.properties),
      });

      return asSuccess({ accepted: true });
    },
  });
};
