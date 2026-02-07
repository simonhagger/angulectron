import type {
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

export interface DesktopFsApi {
  readTextFile: (fileToken: string) => Promise<DesktopResult<string>>;
}

export interface DesktopUpdatesApi {
  check: () => Promise<
    DesktopResult<{
      status: 'checking' | 'available' | 'not-available' | 'error';
      message?: string;
    }>
  >;
}

export interface DesktopExternalApi {
  invoke: (
    operationId: string,
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
  dialog: DesktopDialogApi;
  fs: DesktopFsApi;
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
