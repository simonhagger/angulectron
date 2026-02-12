import { Route } from '@angular/router';
import {
  jwtCanActivateChildGuard,
  jwtCanActivateGuard,
  jwtCanDeactivateGuard,
  jwtCanMatchGuard,
} from './guards/jwt-route.guards';

export const appRoutes: Route[] = [
  {
    path: 'sign-in',
    loadComponent: () =>
      import('./features/auth-signin-bridge/auth-signin-bridge-page').then(
        (m) => m.AuthSigninBridgePage,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'material-showcase',
    loadComponent: () =>
      import('./features/material-showcase/material-showcase-page').then(
        (m) => m.MaterialShowcasePage,
      ),
  },
  {
    path: 'material-carbon-lab',
    loadComponent: () =>
      import('./features/material-carbon-lab/material-carbon-lab-page').then(
        (m) => m.MaterialCarbonLabPage,
      ),
  },
  {
    path: 'carbon-showcase',
    loadComponent: () =>
      import('./features/carbon-showcase/carbon-showcase-page').then(
        (m) => m.CarbonShowcasePage,
      ),
  },
  {
    path: 'tailwind-showcase',
    loadComponent: () =>
      import('./features/tailwind-showcase/tailwind-showcase-page').then(
        (m) => m.TailwindShowcasePage,
      ),
  },
  {
    path: 'form-validation-lab',
    loadComponent: () =>
      import('./features/form-validation-lab/form-validation-lab-page').then(
        (m) => m.FormValidationLabPage,
      ),
  },
  {
    path: 'async-validation-lab',
    loadComponent: () =>
      import('./features/async-validation-lab/async-validation-lab-page').then(
        (m) => m.AsyncValidationLabPage,
      ),
  },
  {
    path: 'data-table-workbench',
    loadComponent: () =>
      import('./features/data-table-workbench/data-table-workbench-page').then(
        (m) => m.DataTableWorkbenchPage,
      ),
  },
  {
    path: 'theme-tokens-playground',
    loadComponent: () =>
      import(
        './features/theme-tokens-playground/theme-tokens-playground-page'
      ).then((m) => m.ThemeTokensPlaygroundPage),
  },
  {
    path: 'offline-retry-simulator',
    loadComponent: () =>
      import(
        './features/offline-retry-simulator/offline-retry-simulator-page'
      ).then((m) => m.OfflineRetrySimulatorPage),
  },
  {
    path: 'file-workflow-studio',
    loadComponent: () =>
      import('./features/file-workflow-studio/file-workflow-studio-page').then(
        (m) => m.FileWorkflowStudioPage,
      ),
  },
  {
    path: 'storage-explorer',
    loadComponent: () =>
      import('./features/storage-explorer/storage-explorer-page').then(
        (m) => m.StorageExplorerPage,
      ),
  },
  {
    path: 'api-playground',
    canMatch: [jwtCanMatchGuard],
    canActivate: [jwtCanActivateGuard],
    canActivateChild: [jwtCanActivateChildGuard],
    children: [
      {
        path: '',
        canDeactivate: [jwtCanDeactivateGuard],
        loadComponent: () =>
          import('./features/api-playground/api-playground-page').then(
            (m) => m.ApiPlaygroundPage,
          ),
      },
    ],
  },
  {
    path: 'updates-release',
    loadComponent: () =>
      import('./features/updates-release/updates-release-page').then(
        (m) => m.UpdatesReleasePage,
      ),
  },
  {
    path: 'telemetry-console',
    loadComponent: () =>
      import('./features/telemetry-console/telemetry-console-page').then(
        (m) => m.TelemetryConsolePage,
      ),
  },
  {
    path: 'ipc-diagnostics',
    loadComponent: () =>
      import('./features/ipc-diagnostics/ipc-diagnostics-page').then(
        (m) => m.IpcDiagnosticsPage,
      ),
  },
  {
    path: 'auth-session-lab',
    loadComponent: () =>
      import('./features/auth-session-lab/auth-session-lab-page').then(
        (m) => m.AuthSessionLabPage,
      ),
  },
  {
    path: 'file-tools',
    loadComponent: () =>
      import('./features/file-tools/file-tools-page').then(
        (m) => m.FileToolsPage,
      ),
  },
];
