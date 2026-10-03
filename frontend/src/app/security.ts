import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LucideCheck, LucidePencil, LucideX } from '@lucide/angular';
import { Auth, errorMessage, formValues } from './auth';

@Component({
  selector: 'app-security',
  imports: [LucideCheck, LucidePencil, LucideX],
  template: `
    <section aria-labelledby="password-title">
      <h2 id="password-title">Mot de passe</h2>

      @if (changing()) {
        <form
          class="settings"
          (submit)="changePassword($event)"
          (keydown.escape)="cancel($event)"
        >
          <label class="settings-row">
            <span>Mot de passe actuel</span>
            <input
              #first
              name="currentPassword"
              type="password"
              autocomplete="current-password"
              required
            />
          </label>
          <label class="settings-row">
            <span>Nouveau mot de passe</span>
            <input
              name="password"
              type="password"
              autocomplete="new-password"
              required
              minlength="8"
              title="8 caractères minimum, avec une majuscule, une minuscule et un chiffre ou un symbole."
            />
          </label>
          <label class="settings-row">
            <span>Confirmation</span>
            <input
              name="confirmation"
              type="password"
              autocomplete="new-password"
              required
            />
          </label>
          <div class="settings-row submit-row">
            <span class="row-actions">
              <button
                class="icon-button confirm"
                title="Enregistrer"
                aria-label="Enregistrer le nouveau mot de passe"
                [disabled]="pending()"
              >
                <svg lucideCheck [size]="18" aria-hidden="true"></svg>
              </button>
              <button
                type="button"
                class="icon-button discard"
                title="Annuler"
                aria-label="Annuler"
                (click)="cancel()"
              >
                <svg lucideX [size]="18" aria-hidden="true"></svg>
              </button>
            </span>
          </div>
        </form>
      } @else {
        <dl class="settings">
          <div class="settings-row">
            <dt>Mot de passe</dt>
            <dd>
              <span aria-label="Masqué">••••••••••</span>
              <span class="row-actions">
                <button
                  type="button"
                  class="icon-button"
                  title="Changer le mot de passe"
                  aria-label="Changer le mot de passe"
                  (click)="edit()"
                >
                  <svg lucidePencil [size]="16" aria-hidden="true"></svg>
                </button>
              </span>
            </dd>
          </div>
        </dl>
      }

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (saved()) {
        <p class="success" role="status">
          Mot de passe modifié. Vos autres sessions ont été déconnectées.
        </p>
      }
    </section>

    <section aria-labelledby="two-factor-title">
      <h2 id="two-factor-title">Authentification à deux facteurs</h2>
      <p class="soon">À venir</p>
    </section>
  `,
  styles: `
    section + section {
      margin-top: 2.5rem;
    }

    h2 {
      margin-bottom: 0.5rem;
      font-size: 1.15rem;
    }

    .soon {
      color: var(--slate);
    }

    input {
      flex: 0 1 16rem;
      min-width: 0;
      padding: 0.35rem 0.6rem;
    }

    .submit-row {
      justify-content: flex-end;
      border-bottom: 0;
    }

    .error,
    .success {
      max-width: 40rem;
      margin-top: 1rem;
    }
  `,
})
export class Security {
  private readonly auth = inject(Auth);
  readonly changing = signal(false);
  readonly pending = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  private readonly first = viewChild<ElementRef<HTMLInputElement>>('first');

  constructor() {
    effect(() => this.first()?.nativeElement.focus());
  }

  edit(): void {
    this.saved.set(false);
    this.error.set('');
    this.changing.set(true);
  }

  // Échap annule la saisie sans fermer la modale qui contient la page.
  cancel(event?: Event): void {
    event?.preventDefault();
    this.error.set('');
    this.changing.set(false);
  }

  changePassword(event: SubmitEvent): void {
    const { currentPassword, password, confirmation } = formValues(event) as {
      currentPassword: string;
      password: string;
      confirmation: string;
    };
    if (password !== confirmation) {
      this.error.set('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }

    this.pending.set(true);
    this.error.set('');
    this.auth.changePassword({ currentPassword, password }).subscribe({
      next: () => {
        this.pending.set(false);
        this.changing.set(false);
        this.saved.set(true);
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }
}
