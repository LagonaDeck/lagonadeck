import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { AppComponent } from './app/app.component';
import { authGuard, refreshExpiredSession } from './app/services/auth.service';
import { DashboardComponent } from './app/dashboard/dashboard.component';
import { HomeComponent } from './app/home/home.component';
import { LoginComponent } from './app/login/login.component';
import { SignupComponent } from './app/signup/signup.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([refreshExpiredSession])),
    provideRouter(
      [
        { path: '', component: HomeComponent, title: 'LagonaDeck' },
        { path: 'login', component: LoginComponent, title: 'Se connecter' },
        {
          path: 'signup',
          component: SignupComponent,
          title: 'Créer un compte',
        },
        {
          path: 'confirm-email',
          loadComponent: () =>
            import('./app/confirm-email/confirm-email.component').then(
              (m) => m.ConfirmEmailComponent,
            ),
          title: 'Confirmer mon adresse',
        },
        {
          path: 'app',
          component: DashboardComponent,
          canActivate: [authGuard],
          children: [
            {
              path: '',
              loadComponent: () =>
                import('./app/overview/overview.component').then(
                  (m) => m.OverviewComponent,
                ),
              title: 'LagonaDeck',
            },
            {
              path: 'purchases',
              loadComponent: () =>
                import('./app/purchases/purchases.component').then(
                  (m) => m.PurchasesComponent,
                ),
              title: 'Achats',
            },
            {
              path: 'purchases/new',
              loadComponent: () =>
                import('./app/purchase-new/purchase-new.component').then(
                  (m) => m.PurchaseNewComponent,
                ),
              title: 'Nouvel achat',
            },
            {
              path: 'purchases/:purchaseId',
              loadComponent: () =>
                import('./app/purchase/purchase.component').then(
                  (m) => m.PurchaseComponent,
                ),
              title: 'Achat',
            },
            {
              path: 'inventory',
              loadComponent: () =>
                import('./app/inventory/inventory.component').then(
                  (m) => m.InventoryComponent,
                ),
              title: 'Inventaire',
            },
            {
              path: 'inventory/:itemId',
              loadComponent: () =>
                import('./app/inventory-item/inventory-item.component').then(
                  (m) => m.InventoryItemComponent,
                ),
              title: 'Fiche produit',
            },
            {
              path: 'invitations',
              loadComponent: () =>
                import('./app/invitations/invitations.component').then(
                  (m) => m.InvitationsComponent,
                ),
              title: 'Invitations',
            },
            {
              path: 'management/reports',
              loadComponent: () =>
                import('./app/management/management.component').then(
                  (m) => m.ManagementComponent,
                ),
              title: 'Signalements cartes incomplètes',
            },
          ],
        },
      ],
      withComponentInputBinding(),
    ),
  ],
}).catch((err) => console.error(err));
