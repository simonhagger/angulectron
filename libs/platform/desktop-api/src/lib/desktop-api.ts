import type {
  ApiGetOperationDiagnosticsResponse,
  ApiFeatureConfig,
  ApiOperationId,
  ApiOperationParamsById,
  ApiOperationResponseDataById,
  AppFeatureConfig,
  AuthGetTokenDiagnosticsResponse,
  AuthFeatureConfig,
  AuthSessionSummary,
  ContractVersion,
  DesktopResult,
  RuntimeConfigDocument,
  RuntimeConfigFeatureKey,
  SettingsExportFeatureConfigResponse,
  SettingsExportRuntimeConfigResponse,
  SettingsImportFeatureConfigResponse,
  SettingsImportRuntimeConfigResponse,
  SettingsRuntimeConfigStateResponse,
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
        pythonExecutable?: string;
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
      pythonExecutable?: string;
      pymupdfAvailable: boolean;
      pymupdfVersion?: string;
      message?: string;
    }>
  >;
  extractText: (fileToken: string) => Promise<
    DesktopResult<{
      accepted: boolean;
      fileName: string;
      fileSizeBytes: number;
      pageCount: number;
      textByPage: Array<{ page: number; text: string }>;
      message?: string;
    }>
  >;
  waveform: (points: number) => Promise<
    DesktopResult<{
      samples: number[];
      spectrum: number[];
      sampleRate: number;
      generatedAt: number;
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

type RuntimeConfigFeatureConfigByKey = {
  app: AppFeatureConfig;
  auth: AuthFeatureConfig;
  api: ApiFeatureConfig;
};

export interface DesktopSettingsApi {
  getRuntimeConfig: () => Promise<
    DesktopResult<SettingsRuntimeConfigStateResponse>
  >;
  saveFeatureConfig: <TFeature extends RuntimeConfigFeatureKey>(
    feature: TFeature,
    config: RuntimeConfigFeatureConfigByKey[TFeature],
  ) => Promise<DesktopResult<SettingsRuntimeConfigStateResponse>>;
  resetFeatureConfig: (
    feature: RuntimeConfigFeatureKey,
  ) => Promise<DesktopResult<SettingsRuntimeConfigStateResponse>>;
  importFeatureConfig: (
    feature: RuntimeConfigFeatureKey,
  ) => Promise<DesktopResult<SettingsImportFeatureConfigResponse>>;
  exportFeatureConfig: (
    feature: RuntimeConfigFeatureKey,
  ) => Promise<DesktopResult<SettingsExportFeatureConfigResponse>>;
  importRuntimeConfig: () => Promise<
    DesktopResult<SettingsImportRuntimeConfigResponse>
  >;
  exportRuntimeConfig: () => Promise<
    DesktopResult<SettingsExportRuntimeConfigResponse>
  >;
}

export interface DesktopAiApi {
  capabilities: () => Promise<
    DesktopResult<{
      pythonVersion: string;
      platform: string;
      cpuCount: number;
      totalMemoryBytes: number | null;
      nvidiaDriverPresent: boolean;
      gpus: Array<{
        name: string;
        vramMb: number | null;
        driverVersion: string | null;
      }>;
      gpuProbeError?: string | null;
      backends: {
        llamaCpp: boolean;
        torch: boolean;
        onnxRuntime: boolean;
        transformers: boolean;
      };
      modelsDir: string;
      models: Array<{ fileName: string; sizeBytes: number }>;
      canRunLocalLlm: boolean;
      recommendedBackend: 'none' | 'llama-cpp';
      notes: string[];
    }>
  >;
  generate: (
    prompt: string,
    maxTokens?: number,
  ) => Promise<
    DesktopResult<{
      available: boolean;
      model?: string;
      text?: string;
      elapsedMs?: number;
      reason?: string;
      guidance?: string[];
    }>
  >;
  mcpInvoke: (
    method: string,
    params?: Record<string, unknown>,
  ) => Promise<
    DesktopResult<{
      jsonrpc: '2.0';
      id: number | string | null;
      result?: unknown;
      error?: { code: number; message: string; data?: unknown };
    }>
  >;
  providerConfigGet: () => Promise<
    DesktopResult<{
      configured: boolean;
      baseUrl?: string;
      model?: string;
      apiKeyPresent: boolean;
    }>
  >;
  providerConfigSave: (config: {
    baseUrl: string;
    model: string;
    apiKey?: string;
  }) => Promise<DesktopResult<{ saved: boolean }>>;
  cliDetect: () => Promise<
    DesktopResult<{
      agents: Array<{
        id: 'claude' | 'codex' | 'opencode';
        available: boolean;
        detail?: string;
      }>;
    }>
  >;
  remoteGenerate: (
    source: 'openai-compatible' | 'cli',
    prompt: string,
    options?: {
      maxTokens?: number;
      cliAgent?: 'claude' | 'codex' | 'opencode';
    },
  ) => Promise<
    DesktopResult<{
      via: string;
      text: string;
      elapsedMs: number;
    }>
  >;
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
  ai: DesktopAiApi;
  telemetry: DesktopTelemetryApi;
  settings: DesktopSettingsApi;
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
