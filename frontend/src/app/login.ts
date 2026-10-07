import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth, errorMessage, formValues } from './auth';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  template: `
    <aside class="panel">
      <a routerLink="/" class="brand">
        <img
          src="logo-light.png"
          alt="LagonaDeck, retour à l'accueil"
          width="1170"
          height="410"
        />
      </a>
      <div class="stage" aria-hidden="true">
        <div class="tcg back">
          <img src="logo-mark.svg" alt="" />
        </div>
      </div>
    </aside>

    <main class="form-side">
      <h1>Se connecter</h1>
      <p class="intro">Retrouvez votre stock, vos lots et vos ventes.</p>
      <form (submit)="submit($event)">
        <label>
          Email
          <input name="email" type="email" autocomplete="email" required />
        </label>
        <label>
          Mot de passe
          <input
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button [disabled]="pending()">
          {{ pending() ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>
      <p class="switch">
        Pas encore de compte ? <a routerLink="/signup">Créer un compte</a>
      </p>
    </main>
  `,
  styleUrl: './auth.css',
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly pending = signal(false);

  submit(event: SubmitEvent): void {
    this.pending.set(true);
    this.auth.login(formValues(event)).subscribe({
      next: () => void this.router.navigate(['/app']),
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }
}
