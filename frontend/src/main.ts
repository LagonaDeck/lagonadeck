import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from './app/app';
import { authGuard, refreshExpiredSession } from './app/auth';
import { Dashboard } from './app/dashboard';
import { Home } from './app/home';
import { Login } from './app/login';
import { Overview } from './app/overview';
import { Signup } from './app/signup';

bootstrapApplication(App, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([refreshExpiredSession])),
    provideRouter(
      [
        { path: '', component: Home, title: 'LagonaDeck' },
        { path: 'login', component: Login, title: 'Se connecter' },
        { path: 'signup', component: Signup, title: 'Créer un compte' },
        {
          path: 'confirm-email',
          loadComponent: () =>
            import('./app/confirm-email').then((m) => m.ConfirmEmail),
          title: 'Confirmer mon adresse',
        },
        {
          path: 'app',
          component: Dashboard,
          canActivate: [authGuard],
          children: [
            { path: '', component: Overview, title: 'LagonaDeck' },
            {
              path: 'purchases',
              loadComponent: () =>
                import('./app/purchases').then((m) => m.Purchases),
              title: 'Achats',
            },
            {
              path: 'purchases/new',
              loadComponent: () =>
                import('./app/purchase-new').then((m) => m.PurchaseNew),
              title: 'Nouvel achat',
            },
            {
              path: 'purchases/:purchaseId',
              loadComponent: () =>
                import('./app/purchase').then((m) => m.PurchasePage),
              title: 'Achat',
            },
            {
              path: 'inventory',
              loadComponent: () =>
                import('./app/inventory').then((m) => m.Inventory),
              title: 'Inventaire',
            },
            {
              path: 'inventory/:itemId',
              loadComponent: () =>
                import('./app/inventory-item').then((m) => m.InventoryItemPage),
              title: 'Fiche produit',
            },
            {
              path: 'invitations',
              loadComponent: () =>
                import('./app/invitations').then((m) => m.Invitations),
              title: 'Invitations',
            },
            {
              path: 'management/reports',
              loadComponent: () =>
                import('./app/management').then((m) => m.Management),
              title: 'Signalements cartes incomplètes',
            },
          ],
        },
      ],
      withComponentInputBinding(),
    ),
  ],
}).catch((err) => console.error(err));
