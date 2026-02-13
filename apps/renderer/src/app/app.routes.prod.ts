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
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
