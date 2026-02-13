import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import type { z } from 'zod';
import { asFailure } from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';

type RegisterValidatedHandlerArgs<TSchema extends z.ZodTypeAny> = {
  ipcMain: IpcMain;
  channel: string;
  schema: TSchema;
  context: MainIpcContext;
  handler: (
    event: IpcMainInvokeEvent,
    request: z.infer<TSchema>,
  ) => unknown | Promise<unknown>;
};

export const registerValidatedHandler = <TSchema extends z.ZodTypeAny>({
  ipcMain,
  channel,
  schema,
  context,
  handler,
}: RegisterValidatedHandlerArgs<TSchema>) => {
  ipcMain.handle(channel, async (event, payload) => {
    const correlationId = context.getCorrelationId(payload);
    const unauthorized = context.assertAuthorizedSender(event, correlationId);
    if (unauthorized) {
      return unauthorized;
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return asFailure(
        'IPC/VALIDATION_FAILED',
        'IPC payload failed validation.',
        parsed.error.flatten(),
        false,
        correlationId,
      );
    }

    return handler(event, parsed.data);
  });
};
