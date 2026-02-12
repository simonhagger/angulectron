import type {
  ApiOperationId,
  AuthGetTokenDiagnosticsResponse,
  AuthSessionSummary,
  ContractVersion,
  DesktopResult,
} from '@electron-foundation/contracts';

export interface DesktopAppApi {
  getContractVersion: () => Promise<DesktopResult<ContractVersion>>;
  getVersion: () => Promise<DesktopResult<string>>;
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
  signOut: () => Promise<DesktopResult<{ signedOut: boolean }>>;
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
  invoke: (
    operationId: ApiOperationId,
    params?: Record<string, string | number | boolean | null>,
  ) => Promise<DesktopResult<{ status: number; data: unknown }>>;
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
