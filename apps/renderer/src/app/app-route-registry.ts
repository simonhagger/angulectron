import { Route } from '@angular/router';
import {
  jwtCanActivateChildGuard,
  jwtCanActivateGuard,
  jwtCanDeactivateGuard,
  jwtCanMatchGuard,
} from './guards/jwt-route.guards';

export type NavLink = {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
  lab?: boolean;
};

type RouteRegistryEntry = {
  path: string;
  label?: string;
  icon?: string;
  exact?: boolean;
  lab?: boolean;
  nav?: boolean;
  toRoute: () => Route;
};

const routeRegistry: ReadonlyArray<RouteRegistryEntry> = [
  {
    path: 'sign-in',
    nav: false,
    toRoute: () => ({
      path: 'sign-in',
      loadComponent: () =>
        import('./features/auth-signin-bridge/auth-signin-bridge-page').then(
          (m) => m.AuthSigninBridgePage,
        ),
    }),
  },
  {
    path: '',
    label: 'Home',
    icon: 'home',
    exact: true,
    lab: false,
    nav: true,
    toRoute: () => ({
      path: '',
      loadComponent: () =>
        import('./features/home/home-page').then((m) => m.HomePage),
    }),
  },
  {
    path: 'material-showcase',
    label: 'Material Showcase',
    icon: 'palette',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'material-showcase',
      loadComponent: () =>
        import('./features/material-showcase/material-showcase-page').then(
          (m) => m.MaterialShowcasePage,
        ),
    }),
  },
  {
    path: 'material-carbon-lab',
    label: 'Material Carbon Lab',
    icon: 'tune',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'material-carbon-lab',
      loadComponent: () =>
        import('./features/material-carbon-lab/material-carbon-lab-page').then(
          (m) => m.MaterialCarbonLabPage,
        ),
    }),
  },
  {
    path: 'carbon-showcase',
    label: 'Carbon Showcase',
    icon: 'view_quilt',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'carbon-showcase',
      loadComponent: () =>
        import('./features/carbon-showcase/carbon-showcase-page').then(
          (m) => m.CarbonShowcasePage,
        ),
    }),
  },
  {
    path: 'tailwind-showcase',
    label: 'Tailwind Showcase',
    icon: 'waterfall_chart',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'tailwind-showcase',
      loadComponent: () =>
        import('./features/tailwind-showcase/tailwind-showcase-page').then(
          (m) => m.TailwindShowcasePage,
        ),
    }),
  },
  {
    path: 'form-validation-lab',
    label: 'Form Validation Lab',
    icon: 'fact_check',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'form-validation-lab',
      loadComponent: () =>
        import('./features/form-validation-lab/form-validation-lab-page').then(
          (m) => m.FormValidationLabPage,
        ),
    }),
  },
  {
    path: 'async-validation-lab',
    label: 'Async Validation Lab',
    icon: 'pending_actions',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'async-validation-lab',
      loadComponent: () =>
        import(
          './features/async-validation-lab/async-validation-lab-page'
        ).then((m) => m.AsyncValidationLabPage),
    }),
  },
  {
    path: 'data-table-workbench',
    label: 'Data Table Workbench',
    icon: 'table_chart',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'data-table-workbench',
      loadComponent: () =>
        import(
          './features/data-table-workbench/data-table-workbench-page'
        ).then((m) => m.DataTableWorkbenchPage),
    }),
  },
  {
    path: 'theme-tokens-playground',
    label: 'Theme Tokens Playground',
    icon: 'format_paint',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'theme-tokens-playground',
      loadComponent: () =>
        import(
          './features/theme-tokens-playground/theme-tokens-playground-page'
        ).then((m) => m.ThemeTokensPlaygroundPage),
    }),
  },
  {
    path: 'offline-retry-simulator',
    label: 'Offline Retry Simulator',
    icon: 'wifi_off',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'offline-retry-simulator',
      loadComponent: () =>
        import(
          './features/offline-retry-simulator/offline-retry-simulator-page'
        ).then((m) => m.OfflineRetrySimulatorPage),
    }),
  },
  {
    path: 'file-workflow-studio',
    label: 'File Workflow Studio',
    icon: 'schema',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'file-workflow-studio',
      loadComponent: () =>
        import(
          './features/file-workflow-studio/file-workflow-studio-page'
        ).then((m) => m.FileWorkflowStudioPage),
    }),
  },
  {
    path: 'storage-explorer',
    label: 'Storage Explorer',
    icon: 'storage',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'storage-explorer',
      loadComponent: () =>
        import('./features/storage-explorer/storage-explorer-page').then(
          (m) => m.StorageExplorerPage,
        ),
    }),
  },
  {
    path: 'api-playground',
    label: 'API Playground',
    icon: 'api',
    lab: true,
    nav: true,
    toRoute: () => ({
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
    }),
  },
  {
    path: 'updates-release',
    label: 'Updates & Release',
    icon: 'system_update',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'updates-release',
      loadComponent: () =>
        import('./features/updates-release/updates-release-page').then(
          (m) => m.UpdatesReleasePage,
        ),
    }),
  },
  {
    path: 'telemetry-console',
    label: 'Telemetry Console',
    icon: 'analytics',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'telemetry-console',
      loadComponent: () =>
        import('./features/telemetry-console/telemetry-console-page').then(
          (m) => m.TelemetryConsolePage,
        ),
    }),
  },
  {
    path: 'ipc-diagnostics',
    label: 'IPC Diagnostics',
    icon: 'cable',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'ipc-diagnostics',
      loadComponent: () =>
        import('./features/ipc-diagnostics/ipc-diagnostics-page').then(
          (m) => m.IpcDiagnosticsPage,
        ),
    }),
  },
  {
    path: 'auth-session-lab',
    label: 'Auth Session Lab',
    icon: 'badge',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'auth-session-lab',
      loadComponent: () =>
        import('./features/auth-session-lab/auth-session-lab-page').then(
          (m) => m.AuthSessionLabPage,
        ),
    }),
  },
  {
    path: 'file-tools',
    label: 'File Tools',
    icon: 'folder_open',
    lab: true,
    nav: true,
    toRoute: () => ({
      path: 'file-tools',
      loadComponent: () =>
        import('./features/file-tools/file-tools-page').then(
          (m) => m.FileToolsPage,
        ),
    }),
  },
];

export const createAppRoutes = (): Route[] =>
  routeRegistry.map((entry) => entry.toRoute());

export const APP_NAV_LINKS: ReadonlyArray<NavLink> = routeRegistry
  .filter((entry) => entry.nav === true)
  .map((entry) => ({
    path: entry.path === '' ? '/' : `/${entry.path}`,
    label: entry.label ?? '',
    icon: entry.icon ?? '',
    exact: entry.exact,
    lab: entry.lab,
  }));
