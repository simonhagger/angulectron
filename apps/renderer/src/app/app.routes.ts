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
    path: 'carbon-showcase',
    loadComponent: () =>
      import('./features/carbon-showcase/carbon-showcase-page').then(
        (m) => m.CarbonShowcasePage,
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
];
