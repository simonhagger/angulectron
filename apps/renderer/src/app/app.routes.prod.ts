import { Route } from '@angular/router';

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
    path: 'settings',
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'app',
      },
      {
        path: '',
        loadComponent: () =>
          import('./features/settings/settings-page').then(
            (m) => m.SettingsPage,
          ),
        children: [
          {
            path: 'app',
            loadComponent: () =>
              import('./features/settings/settings-app/settings-app-page').then(
                (m) => m.SettingsAppPage,
              ),
          },
          {
            path: 'api',
            loadComponent: () =>
              import('./features/settings/settings-api/settings-api-page').then(
                (m) => m.SettingsApiPage,
              ),
          },
          {
            path: 'auth',
            loadComponent: () =>
              import(
                './features/settings/settings-auth/settings-auth-page'
              ).then((m) => m.SettingsAuthPage),
          },
        ],
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
