import type { DesktopAuthApi } from '@electron-foundation/desktop-api';
import {
  authGetSessionSummaryRequestSchema,
  authGetSessionSummaryResponseSchema,
  authGetTokenDiagnosticsRequestSchema,
  authGetTokenDiagnosticsResponseSchema,
  authSignInRequestSchema,
  authSignInResponseSchema,
  authSignOutRequestSchema,
  authSignOutResponseSchema,
  CONTRACT_VERSION,
  IPC_CHANNELS,
} from '@electron-foundation/contracts';
import { createCorrelationId, invokeIpc } from '../invoke-client';

const authSignInTimeoutMs = 5 * 60_000;

export const createAuthApi = (): DesktopAuthApi => ({
  async signIn() {
    const correlationId = createCorrelationId();
    const request = authSignInRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });

    return invokeIpc(
      IPC_CHANNELS.authSignIn,
      request,
      correlationId,
      authSignInResponseSchema,
      authSignInTimeoutMs,
    );
  },

  async signOut() {
    const correlationId = createCorrelationId();
    const request = authSignOutRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });

    return invokeIpc(
      IPC_CHANNELS.authSignOut,
      request,
      correlationId,
      authSignOutResponseSchema,
    );
  },

  async getSessionSummary() {
    const correlationId = createCorrelationId();
    const request = authGetSessionSummaryRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });

    return invokeIpc(
      IPC_CHANNELS.authGetSessionSummary,
      request,
      correlationId,
      authGetSessionSummaryResponseSchema,
    );
  },

  async getTokenDiagnostics() {
    const correlationId = createCorrelationId();
    const request = authGetTokenDiagnosticsRequestSchema.parse({
      contractVersion: CONTRACT_VERSION,
      correlationId,
      payload: {},
    });

    return invokeIpc(
      IPC_CHANNELS.authGetTokenDiagnostics,
      request,
      correlationId,
      authGetTokenDiagnosticsResponseSchema,
    );
  },
});
