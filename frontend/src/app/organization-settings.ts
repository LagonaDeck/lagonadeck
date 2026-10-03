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
    } @else if (tab() === 'members') {
      <app-organization-members
        [organizationId]="organization().id"
        [permissions]="permissions()"
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
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  // Ne sert qu'à afficher ou masquer les actions : le serveur contrôle chaque appel.
  private readonly access = httpResource<{ permissions: string[] }>(
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

  constructor() {
    effect(() => this.field()?.nativeElement.select());
    // Changer d'organisation repart de l'onglet Général, sans saisie en cours.
    effect(() => {
      this.organization();
      this.tab.set('general');
      this.editing.set(false);
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
