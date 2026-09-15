import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'audit',
    loadChildren: () =>
      import('./features/audit/audit.routes').then((routes) => routes.AUDIT_ROUTES),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'audit',
  },
  {
    path: '**',
    redirectTo: 'audit',
  },
];
