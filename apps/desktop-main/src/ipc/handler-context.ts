import type { IpcMainInvokeEvent } from 'electron';
import type {
  ApiGetOperationDiagnosticsResponse,
  ApiInvokeRequest,
  ApiInvokeResponse,
  DesktopResult,
} from '@electron-foundation/contracts';
import type { OidcService } from '../oidc-service';
import type { StorageGateway } from '../storage-gateway';

export type FileSelectionToken = {
  filePath: string;
  expiresAt: number;
  windowId: number;
};

export type MainIpcContext = {
  appVersion: string;
  appEnvironment: 'development' | 'staging' | 'production';
  fileTokenTtlMs: number;
  selectedFileTokens: Map<string, FileSelectionToken>;
  getCorrelationId: (payload: unknown) => string | undefined;
  assertAuthorizedSender: (
    event: IpcMainInvokeEvent,
    correlationId?: string,
  ) => DesktopResult<never> | null;
  getOidcService: () => OidcService | null;
  getStorageGateway: () => StorageGateway;
  invokeApiOperation: (
    request: ApiInvokeRequest,
  ) => Promise<DesktopResult<ApiInvokeResponse>>;
  getApiOperationDiagnostics: (
    operationId: ApiInvokeRequest['payload']['operationId'],
  ) => DesktopResult<ApiGetOperationDiagnosticsResponse>;
  logEvent: (
    level: 'debug' | 'info' | 'warn' | 'error',
    event: string,
    correlationId?: string,
    details?: Record<string, unknown>,
  ) => void;
};
