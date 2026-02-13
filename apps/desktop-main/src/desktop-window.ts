import { app, BrowserWindow, type WebContents } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type NavigationPolicy = {
  isDevelopment: boolean;
  rendererDevUrl: string;
  allowedDevHosts?: ReadonlySet<string>;
};

export type WindowLogger = (
  level: 'warn' | 'error',
  event: string,
  details?: Record<string, unknown>,
) => void;

export type CreateMainWindowOptions = {
  isDevelopment: boolean;
  runtimeSmokeEnabled: boolean;
  shouldOpenDevTools: boolean;
  rendererDevUrl: string;
  onWindowClosed: (windowId: number) => void;
  logger: WindowLogger;
};

const runtimeSmokeSettleMs = 4_000;

const resolveExistingPath = (
  description: string,
  candidates: string[],
): string => {
  for (const candidate of candidates) {
    const absolutePath = path.resolve(__dirname, candidate);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  throw new Error(
    `Unable to resolve ${description}. Checked: ${candidates
      .map((candidate) => path.resolve(__dirname, candidate))
      .join(', ')}`,
  );
};

const resolvePreloadPath = (): string =>
  resolveExistingPath('preload script', [
    '../desktop-preload/main.js',
    '../apps/desktop-preload/main.js',
    '../../desktop-preload/main.js',
    '../../../desktop-preload/main.js',
    '../../../../desktop-preload/main.js',
    '../desktop-preload/src/main.js',
    '../apps/desktop-preload/src/main.js',
    '../../desktop-preload/src/main.js',
    '../../../desktop-preload/src/main.js',
  ]);

const resolveRendererIndexPath = (): string =>
  resolveExistingPath('renderer index', [
    '../../../../renderer/browser/index.html',
    '../renderer/browser/index.html',
    '../../renderer/browser/index.html',
    '../../../renderer/browser/index.html',
  ]);

const resolveWindowIconPath = (): string | undefined => {
  const appPath = app.getAppPath();
  const candidates = [
    path.resolve(process.cwd(), 'build/icon.ico'),
    path.resolve(process.cwd(), 'apps/renderer/public/favicon.ico'),
    path.resolve(appPath, 'build/icon.ico'),
    path.resolve(appPath, 'apps/renderer/public/favicon.ico'),
    path.resolve(__dirname, '../../../../../build/icon.ico'),
    path.resolve(__dirname, '../../../../../../build/icon.ico'),
    path.resolve(__dirname, '../../../../../apps/renderer/public/favicon.ico'),
    path.resolve(
      __dirname,
      '../../../../../../apps/renderer/public/favicon.ico',
    ),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
};

export const resolveRendererDevUrl = (
  rendererDevUrl: string,
  allowedDevHosts: ReadonlySet<string> = new Set(['localhost', '127.0.0.1']),
): URL => {
  const parsed = new URL(rendererDevUrl);
  if (parsed.protocol !== 'http:' || !allowedDevHosts.has(parsed.hostname)) {
    throw new Error(
      `RENDERER_DEV_URL must use http://localhost or http://127.0.0.1. Received: ${rendererDevUrl}`,
    );
  }

  return parsed;
};

export const isAllowedNavigation = (
  targetUrl: string,
  navigationPolicy: NavigationPolicy,
): boolean => {
  try {
    const parsed = new URL(targetUrl);
    if (navigationPolicy.isDevelopment) {
      const allowedDevUrl = resolveRendererDevUrl(
        navigationPolicy.rendererDevUrl,
        navigationPolicy.allowedDevHosts,
      );
      return parsed.origin === allowedDevUrl.origin;
    }

    return parsed.protocol === 'file:';
  } catch {
    return false;
  }
};

const hardenWebContents = (
  contents: WebContents,
  navigationPolicy: NavigationPolicy,
  logger: WindowLogger,
) => {
  contents.setWindowOpenHandler(({ url }) => {
    logger('warn', 'security.window_open_blocked', { url });
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, navigationPolicy)) {
      event.preventDefault();
      logger('warn', 'security.navigation_blocked', { url });
    }
  });
};

const enableRuntimeSmokeMode = (
  window: BrowserWindow,
  logger: WindowLogger,
) => {
  const diagnostics: string[] = [];
  const pushDiagnostic = (message: string) => {
    diagnostics.push(message);
  };

  window.webContents.on('console-message', (details) => {
    if (details.level === 'warning' || details.level === 'error') {
      const label = details.level === 'warning' ? 'warn' : 'error';
      pushDiagnostic(
        `${label} ${details.sourceId}:${details.lineNumber} ${details.message}`,
      );
    }
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    pushDiagnostic(`render-process-gone: ${details.reason}`);
  });

  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    pushDiagnostic(`did-fail-load: ${code} ${description} ${url}`);
  });

  window.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      try {
        await window.webContents.executeJavaScript(`
          (() => {
            const labels = ['Material', 'Carbon', 'Tailwind'];
            let delay = 150;
            for (const label of labels) {
              setTimeout(() => {
                const candidates = [...document.querySelectorAll('a,[role="link"],button')];
                const target = candidates.find((el) =>
                  (el.textContent || '').toLowerCase().includes(label.toLowerCase())
                );
                target?.click();
              }, delay);
              delay += 250;
            }
          })();
        `);
      } catch (error) {
        pushDiagnostic(
          `route-probe-failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      setTimeout(() => {
        if (diagnostics.length > 0) {
          logger('error', 'runtime_smoke.failed', { diagnostics });
          app.exit(1);
          return;
        }

        console.info('Runtime smoke passed: no renderer warnings or errors.');
        app.exit(0);
      }, runtimeSmokeSettleMs);
    }, 250);
  });
};

export const createMainWindow = async (
  options: CreateMainWindowOptions,
): Promise<BrowserWindow> => {
  const navigationPolicy: NavigationPolicy = {
    isDevelopment: options.isDevelopment,
    rendererDevUrl: options.rendererDevUrl,
  };

  const windowIconPath = resolveWindowIconPath();
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#f8f7f1',
    autoHideMenuBar: true,
    ...(windowIconPath ? { icon: windowIconPath } : {}),
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  window.setMenuBarVisibility(false);
  hardenWebContents(window.webContents, navigationPolicy, options.logger);

  if (options.runtimeSmokeEnabled) {
    enableRuntimeSmokeMode(window, options.logger);
  }

  window.on('closed', () => {
    options.onWindowClosed(window.id);
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  if (options.isDevelopment) {
    await window.loadURL(
      resolveRendererDevUrl(options.rendererDevUrl).toString(),
    );
  } else {
    await window.loadFile(resolveRendererIndexPath());
  }

  if (options.shouldOpenDevTools) {
    window.webContents.openDevTools({ mode: 'detach' });
  }

  return window;
};
