import type { IpcMain } from 'electron';
import {
  asFailure,
  asSuccess,
  authGetSessionSummaryRequestSchema,
  authGetTokenDiagnosticsRequestSchema,
  authSignInRequestSchema,
  authSignOutRequestSchema,
  IPC_CHANNELS,
} from '@electron-foundation/contracts';
import type { MainIpcContext } from './handler-context';
import { registerValidatedHandler } from './register-validated-handler';

export const registerAuthIpcHandlers = (
  ipcMain: IpcMain,
  context: MainIpcContext,
) => {
  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.authSignIn,
    schema: authSignInRequestSchema,
    context,
    handler: (event, request) => {
      const oidcService = context.getOidcService();
      if (!oidcService) {
        return asFailure(
          'AUTH/NOT_CONFIGURED',
          'OIDC authentication is not configured for this build.',
          undefined,
          false,
          request.correlationId,
        );
      }

      return oidcService.signIn();
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.authSignOut,
    schema: authSignOutRequestSchema,
    context,
    handler: (_event, request) => {
      const oidcService = context.getOidcService();
      if (!oidcService) {
        return asSuccess({
          signedOut: true,
          mode: request.payload.mode,
          refreshTokenPresent: false,
          refreshTokenRevoked: false,
          revocationSupported: false,
          endSessionSupported: false,
          endSessionInitiated: false,
        });
      }

      return oidcService.signOut(request.payload.mode);
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.authGetSessionSummary,
    schema: authGetSessionSummaryRequestSchema,
    context,
    handler: () => {
      const oidcService = context.getOidcService();
      if (!oidcService) {
        return asSuccess({
          state: 'signed-out' as const,
          scopes: [],
          entitlements: [],
        });
      }

      return oidcService.getSessionSummary();
    },
  });

  registerValidatedHandler({
    ipcMain,
    channel: IPC_CHANNELS.authGetTokenDiagnostics,
    schema: authGetTokenDiagnosticsRequestSchema,
    context,
    handler: () => {
      const oidcService = context.getOidcService();
      if (!oidcService) {
        return asSuccess({
          sessionState: 'signed-out' as const,
          bearerSource: 'access_token' as const,
          accessToken: {
            present: false,
            format: 'absent' as const,
            claims: null,
          },
          idToken: {
            present: false,
            format: 'absent' as const,
            claims: null,
          },
        });
      }

      return oidcService.getTokenDiagnostics();
    },
  });
};
