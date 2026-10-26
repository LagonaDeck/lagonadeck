import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth, errorMessage } from './auth';

@Component({
  selector: 'app-confirm-email',
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
      @switch (state()) {
        @case ('pending') {
          <h1>Confirmation…</h1>
          <p class="intro" role="status">Vérification du lien en cours.</p>
        }
        @case ('confirmed') {
          <h1>Adresse confirmée</h1>
          <p class="intro" role="status">
            Votre compte est activé, vous pouvez vous connecter.
          </p>
          <p class="switch"><a routerLink="/login">Se connecter</a></p>
        }
        @case ('failed') {
          <h1>Lien invalide</h1>
          <p class="intro" role="alert">{{ error() }}</p>
          <p class="switch">
            Pour recevoir un nouveau lien,
            <a routerLink="/login">connectez-vous</a>.
          </p>
        }
      }
    </main>
  `,
  styleUrl: './auth.css',
})
export class ConfirmEmail implements OnInit {
  private readonly auth = inject(Auth);
  readonly token = input('');
  readonly state = signal<'pending' | 'confirmed' | 'failed'>('pending');
  readonly error = signal('');

  ngOnInit(): void {
    this.auth.confirmEmail(this.token()).subscribe({
      next: () => this.state.set('confirmed'),
      error: (error: HttpErrorResponse) => {
        this.error.set(errorMessage(error));
        this.state.set('failed');
      },
    });
  }
}
