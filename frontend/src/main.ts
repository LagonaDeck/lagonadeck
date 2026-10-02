import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { App } from './app/app';
import { ComingSoon } from './app/coming-soon';
import { Home } from './app/home';

bootstrapApplication(App, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter([
      { path: '', component: Home, title: 'LagonaDeck' },
      { path: 'login', component: ComingSoon, title: 'Se connecter' },
      { path: 'signup', component: ComingSoon, title: 'Créer un compte' },
    ]),
  ],
}).catch((err) => console.error(err));
