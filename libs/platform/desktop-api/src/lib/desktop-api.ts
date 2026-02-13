import type {
  ApiGetOperationDiagnosticsResponse,
  ApiOperationId,
  ApiOperationParamsById,
  ApiOperationResponseDataById,
  AuthGetTokenDiagnosticsResponse,
  AuthSessionSummary,
  ContractVersion,
  DesktopResult,
} from '@electron-foundation/contracts';

export interface DesktopAppApi {
  getContractVersion: () => Promise<DesktopResult<ContractVersion>>;
  getVersion: () => Promise<DesktopResult<string>>;
  getRuntimeVersions: () => Promise<
    DesktopResult<{
      electron: string;
      node: string;
      chrome: string;
      appEnvironment: 'development' | 'staging' | 'production';
    }>
  >;
}

export interface DesktopDialogApi {
  openFile: (request?: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<
    DesktopResult<{ canceled: boolean; fileName?: string; fileToken?: string }>
  >;
}

export interface DesktopAuthApi {
  signIn: () => Promise<DesktopResult<{ initiated: boolean }>>;
  signOut: (mode?: 'local' | 'global') => Promise<
    DesktopResult<{
      signedOut: boolean;
      mode: 'local' | 'global';
      refreshTokenPresent: boolean;
      refreshTokenRevoked: boolean;
      revocationSupported: boolean;
      endSessionSupported: boolean;
      endSessionInitiated: boolean;
    }>
  >;
  getSessionSummary: () => Promise<DesktopResult<AuthSessionSummary>>;
  getTokenDiagnostics: () => Promise<
    DesktopResult<AuthGetTokenDiagnosticsResponse>
  >;
}

export interface DesktopFsApi {
  readTextFile: (fileToken: string) => Promise<DesktopResult<string>>;
}

export interface DesktopUpdatesApi {
  check: () => Promise<
    DesktopResult<{
      status: 'available' | 'not-available' | 'error';
      message?: string;
      source?: 'native' | 'demo';
      currentVersion?: string;
      latestVersion?: string;
      demoFilePath?: string;
    }>
  >;
  applyDemoPatch: () => Promise<
    DesktopResult<{
      applied: boolean;
      status: 'available' | 'not-available' | 'error';
      message?: string;
      source: 'demo';
      currentVersion?: string;
      latestVersion?: string;
      demoFilePath?: string;
    }>
  >;
}

export interface DesktopPythonApi {
  probe: () => Promise<
    DesktopResult<{
      available: boolean;
      started: boolean;
      running: boolean;
      endpoint: string;
      pid?: number;
      pythonCommand?: string;
      message?: string;
      health?: {
        status: string;
        service: string;
        pythonVersion: string;
        pymupdfAvailable: boolean;
        pymupdfVersion?: string;
        pymupdfError?: string;
      };
    }>
  >;
  inspectPdf: (fileToken: string) => Promise<
    DesktopResult<{
      accepted: boolean;
      fileName: string;
      fileSizeBytes: number;
      headerHex: string;
      pythonVersion: string;
      pymupdfAvailable: boolean;
      pymupdfVersion?: string;
      message?: string;
    }>
  >;
  stop: () => Promise<
    DesktopResult<{
      stopped: boolean;
      running: boolean;
      message?: string;
    }>
  >;
}

export interface DesktopStorageApi {
  setItem: (
    domain: 'settings' | 'cache',
    key: string,
    value: unknown,
    classification?: 'internal' | 'sensitive',
    options?: { ttlSeconds?: number },
  ) => Promise<DesktopResult<{ updated: boolean }>>;
  getItem: (
    domain: 'settings' | 'cache',
    key: string,
  ) => Promise<
    DesktopResult<{
      found: boolean;
      value?: unknown;
      classification?: 'internal' | 'sensitive';
    }>
  >;
  deleteItem: (
    domain: 'settings' | 'cache',
    key: string,
  ) => Promise<DesktopResult<{ deleted: boolean }>>;
  clearDomain: (
    domain: 'settings' | 'cache',
  ) => Promise<DesktopResult<{ cleared: number }>>;
}

export interface DesktopExternalApi {
  invoke: <TOperationId extends ApiOperationId>(
    operationId: TOperationId,
    params?: ApiOperationParamsById[TOperationId],
    options?: { headers?: Record<string, string> },
  ) => Promise<
    DesktopResult<{
      status: number;
      data: ApiOperationResponseDataById[TOperationId];
      requestPath?: string;
    }>
  >;
  getOperationDiagnostics: (
    operationId: ApiOperationId,
  ) => Promise<DesktopResult<ApiGetOperationDiagnosticsResponse>>;
}

export interface DesktopTelemetryApi {
  track: (
    eventName: string,
    properties?: Record<string, string | number | boolean>,
  ) => Promise<DesktopResult<{ accepted: boolean }>>;
}

export interface DesktopApi {
  app: DesktopAppApi;
  auth: DesktopAuthApi;
  dialog: DesktopDialogApi;
  fs: DesktopFsApi;
  storage: DesktopStorageApi;
  api: DesktopExternalApi;
  updates: DesktopUpdatesApi;
  python: DesktopPythonApi;
  telemetry: DesktopTelemetryApi;
}

export const getDesktopApi = (): DesktopApi | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.desktop ?? null;
};

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
