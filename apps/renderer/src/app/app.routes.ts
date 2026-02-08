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
];
