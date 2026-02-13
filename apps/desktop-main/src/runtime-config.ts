import { app, type App } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type AppEnvironment = 'development' | 'staging' | 'production';

const packageJsonCandidates = [
  '../../../../package.json',
  '../../../package.json',
  '../../package.json',
  '../package.json',
];

const resolvePackageJsonPath = (candidate: string): string =>
  path.resolve(__dirname, candidate);

const readPackageJsonField = <T>(field: string): T | null => {
  for (const candidate of packageJsonCandidates) {
    try {
      const absolutePath = resolvePackageJsonPath(candidate);
      if (!existsSync(absolutePath)) {
        continue;
      }

      const raw = require(absolutePath) as Record<string, unknown>;
      if (field in raw) {
        return raw[field] as T;
      }
    } catch {
      // Ignore and continue fallback chain.
    }
  }

  return null;
};

const resolveIsStagingExecutable = (): boolean =>
  path.basename(process.execPath).toLowerCase().includes('staging');

export const resolveAppEnvironment = (
  electronApp: App = app,
): AppEnvironment => {
  const envValue = process.env.APP_ENV?.trim().toLowerCase();
  if (
    envValue === 'development' ||
    envValue === 'staging' ||
    envValue === 'production'
  ) {
    return envValue;
  }

  const packageAppEnv = readPackageJsonField<unknown>('appEnv');
  if (
    packageAppEnv === 'development' ||
    packageAppEnv === 'staging' ||
    packageAppEnv === 'production'
  ) {
    return packageAppEnv;
  }

  return electronApp.isPackaged ? 'production' : 'development';
};

export const resolveAppMetadataVersion = (electronApp: App = app): string => {
  const envVersion = process.env.npm_package_version?.trim();
  if (envVersion) {
    return envVersion;
  }

  const packageVersion = readPackageJsonField<unknown>('version');
  if (typeof packageVersion === 'string' && packageVersion.trim().length > 0) {
    return packageVersion.trim();
  }

  return electronApp.getVersion();
};

export const resolveRuntimeFlags = (electronApp: App = app) => {
  const runtimeSmokeEnabled = process.env.RUNTIME_SMOKE === '1';
  const isDevelopment = !electronApp.isPackaged && !runtimeSmokeEnabled;
  const appEnvironment = resolveAppEnvironment(electronApp);
  const packagedDevToolsOverride = process.env.DESKTOP_ENABLE_DEVTOOLS;
  const allowPackagedDevTools =
    electronApp.isPackaged &&
    (appEnvironment === 'staging' || resolveIsStagingExecutable()) &&
    packagedDevToolsOverride !== '0';

  return {
    runtimeSmokeEnabled,
    isDevelopment,
    appEnvironment,
    shouldOpenDevTools:
      !runtimeSmokeEnabled && (isDevelopment || allowPackagedDevTools),
    rendererDevUrl: process.env.RENDERER_DEV_URL ?? 'http://localhost:4200',
  };
};
