import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LucideCheck, LucidePencil, LucideX } from '@lucide/angular';
import { Auth, errorMessage, formValues } from './auth';

type Field = 'username' | 'email';

@Component({
  selector: 'app-profile-form',
  imports: [LucideCheck, LucidePencil, LucideX, NgTemplateOutlet],
  template: `
    <div class="photo-header">
      <span class="avatar" aria-hidden="true">{{ initials() }}</span>
      <!-- TODO: brancher sur l'envoi de photo (media-service) quand il sera relayé par la gateway. -->
      <button
        type="button"
        class="link-button"
        disabled
        title="Bientôt disponible"
      >
        Modifier
      </button>
    </div>

    <dl class="settings">
      <div class="settings-row">
        <dt id="username-label">Nom d'utilisateur</dt>
        <dd>
          @if (editing() === 'username') {
            <form (submit)="save($event)">
              <input
                #field
                name="username"
                autocomplete="username"
                required
                minlength="3"
                maxlength="30"
                pattern="[A-Za-z0-9._\\-]+"
                title="3 à 30 caractères : lettres sans accent, chiffres, point, tiret et tiret bas."
                aria-labelledby="username-label"
                [value]="auth.user()?.username ?? ''"
                (keydown.escape)="cancel($event)"
              />
              <ng-container *ngTemplateOutlet="actions" />
            </form>
          } @else {
            <span>{{ auth.user()?.username }}</span>
            <ng-container
              *ngTemplateOutlet="
                editButton;
                context: {
                  field: 'username',
                  label: 'Modifier le nom d’utilisateur',
                }
              "
            />
          }
        </dd>
      </div>

      <div class="settings-row">
        <dt id="email-label">Email</dt>
        <dd>
          @if (editing() === 'email') {
            <form (submit)="save($event)">
              <input
                #field
                name="email"
                type="email"
                autocomplete="email"
                required
                aria-labelledby="email-label"
                [value]="auth.user()?.email ?? ''"
                (keydown.escape)="cancel($event)"
              />
              <ng-container *ngTemplateOutlet="actions" />
            </form>
          } @else {
            <span>{{ auth.user()?.email }}</span>
            <ng-container
              *ngTemplateOutlet="
                editButton;
                context: { field: 'email', label: 'Modifier l’email' }
              "
            />
          }
        </dd>
      </div>
    </dl>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <ng-template #editButton let-field="field" let-label="label">
      <span class="row-actions">
        <button
          type="button"
          class="icon-button"
          [title]="label"
          [attr.aria-label]="label"
          (click)="edit(field)"
        >
          <svg lucidePencil [size]="16" aria-hidden="true"></svg>
        </button>
      </span>
    </ng-template>

    <ng-template #actions>
      <span class="row-actions">
        <button
          class="icon-button confirm"
          title="Enregistrer"
          aria-label="Enregistrer"
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
    </ng-template>
  `,
  styles: `
    .avatar {
      display: grid;
      place-items: center;
      width: 6rem;
      aspect-ratio: 1;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--blue), var(--violet));
      color: #fff;
      font-size: 2rem;
      font-weight: 700;
    }

    /* La marge négative compense padding et bordure : le texte saisi reste
       aligné sur la valeur affichée. */
    input {
      flex: 0 1 16rem;
      min-width: 0;
      margin-right: calc(-0.6rem - 2px);
      padding: 0.35rem 0.6rem;
      text-align: right;
    }

    .error {
      max-width: 40rem;
      margin-top: 1rem;
    }
  `,
})
export class ProfileForm {
  readonly auth = inject(Auth);
  readonly editing = signal<Field | null>(null);
  readonly error = signal('');
  readonly pending = signal(false);
  readonly initials = computed(() =>
    (this.auth.user()?.username ?? '').slice(0, 2).toUpperCase(),
  );
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    effect(() => this.field()?.nativeElement.select());
  }

  edit(field: Field): void {
    this.error.set('');
    this.editing.set(field);
  }

  // Échap annule la modification sans fermer la modale qui contient la page.
  cancel(event?: Event): void {
    event?.preventDefault();
    this.error.set('');
    this.editing.set(null);
  }

  save(event: SubmitEvent): void {
    this.pending.set(true);
    this.auth.updateProfile(formValues(event)).subscribe({
      next: () => {
        this.pending.set(false);
        this.editing.set(null);
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }
}
