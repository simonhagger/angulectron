import { Route } from '@angular/router';

export const appRoutes: Route[] = [
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
    path: 'storage-explorer',
    loadComponent: () =>
      import('./features/storage-explorer/storage-explorer-page').then(
        (m) => m.StorageExplorerPage,
      ),
  },
  {
    path: 'api-playground',
    loadComponent: () =>
      import('./features/api-playground/api-playground-page').then(
        (m) => m.ApiPlaygroundPage,
      ),
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
    path: 'file-tools',
    loadComponent: () =>
      import('./features/file-tools/file-tools-page').then(
        (m) => m.FileToolsPage,
      ),
  },
];
