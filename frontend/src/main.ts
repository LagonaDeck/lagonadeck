import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { App } from './app/app';
import { authGuard, refreshExpiredSession } from './app/auth';
import { Dashboard } from './app/dashboard';
import { Home } from './app/home';
import { Login } from './app/login';
import { Signup } from './app/signup';

bootstrapApplication(App, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([refreshExpiredSession])),
    provideRouter([
      { path: '', component: Home, title: 'LagonaDeck' },
      { path: 'login', component: Login, title: 'Se connecter' },
      { path: 'signup', component: Signup, title: 'Créer un compte' },
      {
        path: 'app',
        component: Dashboard,
        canActivate: [authGuard],
        title: 'LagonaDeck',
      },
    ]),
  ],
}).catch((err) => console.error(err));
