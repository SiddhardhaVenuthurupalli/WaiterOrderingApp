import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    data: { title: 'Login' },
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'selectTable',
    data: { title: 'Select Table' },
    loadComponent: () => import('./select-table/select-table.page').then((m) => m.SelectTablePage),
  },
  {
    path: 'menu',
    data: { title: 'Menu' },
    loadComponent: () => import('./menu/menu.page').then((m) => m.MenuPage),
  },
];
