import { HttpErrorResponse, httpResource } from '@angular/common/http';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { LucideCheck, LucidePencil, LucideX } from '@lucide/angular';
import { errorMessage, formValues } from './auth';
import { OrganizationGroups } from './organization-groups';
import { OrganizationMembers } from './organization-members';
import {
  Organization,
  Organizations,
  organizationInitials,
  planLabel,
  roleLabel,
} from './organizations';

type Tab = 'general' | 'members' | 'groups';

const DELETE_CONFIRMATION =
  'Je confirme que je veux supprimer mon organisation';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'Général' },
  { id: 'members', label: 'Membres' },
  { id: 'groups', label: 'Groupes' },
];

@Component({
  selector: 'app-organization-settings',
  imports: [
    LucideCheck,
    LucidePencil,
    LucideX,
    OrganizationGroups,
    OrganizationMembers,
  ],
  template: `
    <nav class="tabs" aria-label="Sections de l'organisation">
      @for (item of tabs; track item.id) {
        <button
          type="button"
          [attr.aria-current]="tab() === item.id"
          (click)="tab.set(item.id)"
        >
          {{ item.label }}
        </button>
      }
    </nav>

    @if (tab() === 'general') {
      <div class="photo-header">
        <span class="org-photo" aria-hidden="true">{{ initials() }}</span>
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
          <dt id="organization-name-label">Nom</dt>
          <dd>
            @if (editing()) {
              <form (submit)="rename($event)">
                <input
                  #field
                  name="name"
                  required
                  maxlength="100"
                  aria-labelledby="organization-name-label"
                  [value]="organization().name"
                  (keydown.escape)="cancel($event)"
                />
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
              </form>
            } @else {
              <span>{{ organization().name }}</span>
              <span class="row-actions">
                @if (canManage()) {
                  <button
                    type="button"
                    class="icon-button"
                    title="Renommer l’organisation"
                    aria-label="Renommer l’organisation"
                    (click)="edit()"
                  >
                    <svg lucidePencil [size]="16" aria-hidden="true"></svg>
                  </button>
                }
              </span>
            }
          </dd>
        </div>
        <div class="settings-row">
          <dt>Plan</dt>
          <dd>
            <span>{{ plan() }}</span>
            <span class="row-actions"></span>
          </dd>
        </div>
        <div class="settings-row">
          <dt>Mon rôle</dt>
          <dd>
            <span>{{ role() }}</span>
            <span class="row-actions"></span>
          </dd>
        </div>
      </dl>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      @if (isOwner()) {
        <section class="danger" aria-labelledby="delete-title">
          <h2 id="delete-title">Supprimer l’organisation</h2>
          <p>
            Les membres, les groupes et les invitations sont supprimés avec
            elle. Cette action est définitive.
          </p>

          @switch (deleteStep()) {
            @case ('idle') {
              <button
                type="button"
                class="danger-button"
                (click)="deleteStep.set('name')"
              >
                Supprimer l’organisation
              </button>
            }
            @case ('name') {
              <label class="confirm-field">
                <span>
                  Pour continuer, saisissez le nom de l’organisation :
                  <strong>{{ organization().name }}</strong>
                </span>
                <input
                  #confirmField
                  autocomplete="off"
                  (input)="typed.set($any($event.target).value)"
                  (keydown.escape)="cancelDelete($event)"
                />
              </label>
              <div class="danger-actions">
                <button
                  type="button"
                  class="danger-button"
                  [disabled]="typed().trim() !== organization().name"
                  (click)="nextDeleteStep()"
                >
                  Continuer
                </button>
                <button
                  type="button"
                  class="link-button"
                  (click)="cancelDelete()"
                >
                  Annuler
                </button>
              </div>
            }
            @case ('phrase') {
              <label class="confirm-field">
                <span>
                  Saisissez :
                  <strong>{{ confirmationPhrase }}</strong>
                </span>
                <input
                  #confirmField
                  autocomplete="off"
                  (input)="typed.set($any($event.target).value)"
                  (keydown.escape)="cancelDelete($event)"
                />
              </label>
              <div class="danger-actions">
                <button
                  type="button"
                  class="danger-button"
                  [disabled]="
                    typed().trim() !== confirmationPhrase || pending()
                  "
                  (click)="deleteOrganization()"
                >
                  Supprimer définitivement
                </button>
                <button
                  type="button"
                  class="link-button"
                  (click)="cancelDelete()"
                >
                  Annuler
                </button>
              </div>
            }
          }
        </section>
      }
    } @else if (tab() === 'members') {
      <app-organization-members
        [organizationId]="organization().id"
        [permissions]="permissions()"
        [isOwner]="isOwner()"
        (ownershipTransferred)="access.reload()"
      />
    } @else {
      <app-organization-groups
        [organizationId]="organization().id"
        [myPermissions]="permissions()"
      />
    }
  `,
  styles: `
    .tabs {
      display: flex;
      gap: 0.25rem;
      max-width: 40rem;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid var(--rule);
    }

    .tabs button {
      margin-bottom: -1px;
      padding: 0.6rem 0.9rem;
      border: 0;
      border-bottom: 2px solid transparent;
      background: none;
      color: var(--slate);
      font: inherit;
      cursor: pointer;
    }

    .tabs button:hover {
      color: var(--ink);
    }

    .tabs [aria-current='true'] {
      border-bottom-color: var(--blue);
      color: var(--ink);
      font-weight: 700;
    }

    .org-photo {
      display: grid;
      place-items: center;
      width: 6rem;
      aspect-ratio: 1;
      border-radius: 1.25rem;
      background: linear-gradient(135deg, var(--teal), var(--blue));
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

    .danger {
      max-width: 40rem;
      margin-top: 2.5rem;
      padding: 1.25rem;
      border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--rule));
      border-radius: 0.75rem;
    }

    .danger h2 {
      margin-bottom: 0.5rem;
      color: var(--danger);
      font-size: 1.15rem;
    }

    .danger p {
      margin-bottom: 1rem;
      color: var(--slate);
      font-size: 0.9rem;
    }

    .confirm-field {
      display: grid;
      gap: 0.5rem;
      font-size: 0.9rem;
    }

    .confirm-field input {
      padding: 0.5rem 0.75rem;
      text-align: left;
      margin-right: 0;
    }

    .danger-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 0.75rem;
    }

    .danger-button {
      padding: 0.5rem 0.9rem;
      border: 0;
      border-radius: 0.5rem;
      background: var(--danger);
      color: #fff;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
    }

    .danger-button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `,
})
export class OrganizationSettings {
  private readonly organizations = inject(Organizations);
  readonly organization = input.required<Organization>();
  readonly tabs = TABS;
  readonly tab = signal<Tab>('general');
  readonly editing = signal(false);
  readonly pending = signal(false);
  readonly error = signal('');
  readonly confirmationPhrase = DELETE_CONFIRMATION;
  readonly deleteStep = signal<'idle' | 'name' | 'phrase'>('idle');
  readonly typed = signal('');
  private readonly confirmField =
    viewChild<ElementRef<HTMLInputElement>>('confirmField');
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  // Ne sert qu'à afficher ou masquer les actions : le serveur contrôle chaque appel.
  readonly access = httpResource<{ permissions: string[] }>(
    () => `/api/organizations/${this.organization().id}/me`,
  );
  readonly permissions = computed(() => this.access.value()?.permissions ?? []);
  readonly canManage = computed(() =>
    this.permissions().includes('ORGANIZATION_MANAGE'),
  );
  readonly plan = computed(() => planLabel(this.organization().plan));
  readonly initials = computed(() =>
    organizationInitials(this.organization().name),
  );
  readonly role = computed(() => roleLabel(this.organization()));
  // Le groupe Owner ne se renomme pas : son nom identifie le propriétaire.
  readonly isOwner = computed(() =>
    this.organization().groups.includes('Owner'),
  );

  constructor() {
    effect(() => this.field()?.nativeElement.select());
    effect(() => this.confirmField()?.nativeElement.focus());
    // Changer d'organisation repart de l'onglet Général, sans saisie en cours.
    effect(() => {
      this.organization();
      this.tab.set('general');
      this.editing.set(false);
      this.deleteStep.set('idle');
      this.typed.set('');
      this.error.set('');
    });
  }

  edit(): void {
    this.error.set('');
    this.editing.set(true);
  }

  // Échap annule la modification sans fermer la modale qui contient la page.
  cancel(event?: Event): void {
    event?.preventDefault();
    this.error.set('');
    this.editing.set(false);
  }

  nextDeleteStep(): void {
    this.typed.set('');
    this.deleteStep.set('phrase');
  }

  // Échap annule la suppression sans fermer la modale qui contient la page.
  cancelDelete(event?: Event): void {
    event?.preventDefault();
    this.typed.set('');
    this.deleteStep.set('idle');
  }

  deleteOrganization(): void {
    this.pending.set(true);
    this.error.set('');
    this.organizations.delete(this.organization().id).subscribe({
      next: () => this.pending.set(false),
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }

  rename(event: SubmitEvent): void {
    const { name } = formValues(event) as { name: string };
    this.pending.set(true);
    this.organizations.rename(this.organization().id, name).subscribe({
      next: () => {
        this.pending.set(false);
        this.editing.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }
}
