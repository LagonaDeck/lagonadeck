import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth, errorMessage, formValues } from './auth';

@Component({
  selector: 'app-signup',
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
        <article class="tcg front">
          <header class="front-top">
            <p class="front-name" [class.empty]="!username()">
              {{ username() || 'Votre nom' }}
            </p>
            <p class="front-plan">Découverte</p>
          </header>
          <div class="art">{{ username().slice(0, 2).toUpperCase() }}</div>
          <p class="strip">Membre depuis {{ memberSince }}</p>
          <div class="attack">
            <p class="attack-name">
              <span>Plan gratuit</span><span>0 CHF</span>
            </p>
            <p>
              Jusqu’à 50 articles en stock, achats en lots et plateformes de
              vente.
            </p>
          </div>
        </article>
      </div>
    </aside>

    <main class="form-side">
      <h1>Créer un compte</h1>
      <p class="intro">Gratuit jusqu'à 50 articles.</p>
      <form (submit)="submit($event)">
        <label>
          Email
          <input name="email" type="email" autocomplete="email" required />
        </label>
        <label>
          Nom d'utilisateur
          <input
            #usernameInput
            name="username"
            autocomplete="username"
            required
            minlength="3"
            maxlength="30"
            pattern="[A-Za-z0-9._\\-]+"
            aria-describedby="username-hint"
            (input)="username.set(usernameInput.value)"
          />
          <span id="username-hint" class="hint">
            3 à 30 caractères : lettres sans accent, chiffres, point, tiret et
            tiret bas.
          </span>
        </label>
        <label>
          Mot de passe
          <input
            name="password"
            type="password"
            autocomplete="new-password"
            required
            minlength="8"
            aria-describedby="password-hint"
          />
          <span id="password-hint" class="hint">
            8 caractères minimum, avec une majuscule, une minuscule et un
            chiffre ou un symbole.
          </span>
        </label>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button [disabled]="pending()">
          {{ pending() ? 'Création du compte…' : 'Créer un compte' }}
        </button>
      </form>
      <p class="switch">
        Déjà un compte ? <a routerLink="/login">Se connecter</a>
      </p>
    </main>
  `,
  styleUrl: './auth.css',
})
export class Signup {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly pending = signal(false);
  readonly username = signal('');
  readonly memberSince = new Intl.DateTimeFormat('fr-CH', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  submit(event: SubmitEvent): void {
    this.pending.set(true);
    this.auth.signup(formValues(event)).subscribe({
      next: () => void this.router.navigate(['/app']),
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }
}
