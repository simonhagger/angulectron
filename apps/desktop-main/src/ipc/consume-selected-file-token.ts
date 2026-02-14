import path from 'node:path';
import { BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import {
  asFailure,
  asSuccess,
  type DesktopResult,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';

export type ConsumedSelectedFileToken = {
  filePath: string;
  fileName: string;
};

export const consumeSelectedFileToken = (
  event: IpcMainInvokeEvent,
  fileToken: string,
  context: MainIpcContext,
  correlationId?: string,
): DesktopResult<ConsumedSelectedFileToken> => {
  const selected = context.selectedFileTokens.get(fileToken);
  if (!selected || selected.expiresAt <= Date.now()) {
    context.selectedFileTokens.delete(fileToken);
    return asFailure(
      'FS/INVALID_TOKEN',
      'The selected file token is invalid or expired.',
      undefined,
      false,
      correlationId,
    );
  }

  const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
  if (senderWindowId !== selected.windowId) {
    context.selectedFileTokens.delete(fileToken);
    return asFailure(
      'FS/INVALID_TOKEN_SCOPE',
      'Selected file token was issued for a different window.',
      {
        senderWindowId: senderWindowId ?? null,
        tokenWindowId: selected.windowId,
      },
      false,
      correlationId,
    );
  }

  context.selectedFileTokens.delete(fileToken);
  return asSuccess({
    filePath: selected.filePath,
    fileName: path.basename(selected.filePath),
  });
};
