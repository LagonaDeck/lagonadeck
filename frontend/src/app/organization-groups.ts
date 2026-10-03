import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
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
import { Observable } from 'rxjs';
import {
  LucideCheck,
  LucideChevronDown,
  LucideChevronRight,
  LucidePencil,
  LucidePlus,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { errorMessage, formValues } from './auth';

interface Group {
  id: string;
  name: string;
  isOwner: boolean;
  permissions: string[];
  memberIds: string[];
}

interface Member {
  userId: string;
  username: string;
}

const PERMISSIONS: { id: string; label: string }[] = [
  { id: 'ORGANIZATION_MANAGE', label: 'Gérer l’organisation' },
  { id: 'MEMBER_INVITE', label: 'Inviter des membres' },
  { id: 'MEMBER_REMOVE', label: 'Retirer des membres' },
  { id: 'MEMBER_MANAGE_GROUPS', label: 'Gérer les membres des groupes' },
  { id: 'GROUP_CREATE', label: 'Créer des groupes' },
  { id: 'GROUP_UPDATE', label: 'Renommer les groupes' },
  { id: 'GROUP_DELETE', label: 'Supprimer les groupes' },
  {
    id: 'GROUP_MANAGE_PERMISSIONS',
    label: 'Gérer les permissions des groupes',
  },
  { id: 'BILLING_VIEW', label: 'Voir la facturation' },
  { id: 'BILLING_MANAGE', label: 'Gérer la facturation' },
];

@Component({
  selector: 'app-organization-groups',
  imports: [
    LucideCheck,
    LucideChevronDown,
    LucideChevronRight,
    LucidePencil,
    LucidePlus,
    LucideTrash2,
    LucideX,
  ],
  template: `
    <div class="section-header">
      <h2>Groupes</h2>
      @if (can('GROUP_CREATE') && !creating()) {
        <button type="button" class="small-button" (click)="startCreate()">
          <svg lucidePlus [size]="16" aria-hidden="true"></svg>
          Créer un groupe
        </button>
      }
    </div>

    @if (creating()) {
      <form class="row" (submit)="create($event)">
        <input
          name="name"
          required
          maxlength="100"
          aria-label="Nom du nouveau groupe"
          placeholder="Nom du groupe"
          (keydown.escape)="stopCreate($event)"
          #field
        />
        <span class="row-actions">
          <button
            class="icon-button confirm"
            title="Créer"
            aria-label="Créer le groupe"
          >
            <svg lucideCheck [size]="18" aria-hidden="true"></svg>
          </button>
          <button
            type="button"
            class="icon-button discard"
            title="Annuler"
            aria-label="Annuler"
            (click)="stopCreate()"
          >
            <svg lucideX [size]="18" aria-hidden="true"></svg>
          </button>
        </span>
      </form>
    }

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <ul class="groups">
      @for (group of groups.value() ?? []; track group.id) {
        <li>
          @if (renaming() === group.id) {
            <form class="row" (submit)="rename($event, group)">
              <input
                name="name"
                required
                maxlength="100"
                aria-label="Nouveau nom du groupe"
                [value]="group.name"
                (keydown.escape)="stopRename($event)"
                #field
              />
              <span class="row-actions">
                <button
                  class="icon-button confirm"
                  title="Enregistrer"
                  aria-label="Enregistrer"
                >
                  <svg lucideCheck [size]="18" aria-hidden="true"></svg>
                </button>
                <button
                  type="button"
                  class="icon-button discard"
                  title="Annuler"
                  aria-label="Annuler"
                  (click)="stopRename()"
                >
                  <svg lucideX [size]="18" aria-hidden="true"></svg>
                </button>
              </span>
            </form>
          } @else {
            <div class="row">
              <button
                type="button"
                class="toggle"
                [attr.aria-expanded]="open() === group.id"
                (click)="toggle(group)"
              >
                @if (open() === group.id) {
                  <svg lucideChevronDown [size]="16" aria-hidden="true"></svg>
                } @else {
                  <svg lucideChevronRight [size]="16" aria-hidden="true"></svg>
                }
                <strong>{{ group.name }}</strong>
                <span class="count">{{ memberCount(group) }}</span>
              </button>
              <span class="row-actions">
                @if (!group.isOwner && can('GROUP_UPDATE')) {
                  <button
                    type="button"
                    class="icon-button"
                    [title]="'Renommer ' + group.name"
                    [attr.aria-label]="'Renommer ' + group.name"
                    (click)="renaming.set(group.id)"
                  >
                    <svg lucidePencil [size]="16" aria-hidden="true"></svg>
                  </button>
                }
                @if (!group.isOwner && can('GROUP_DELETE')) {
                  <button
                    type="button"
                    class="icon-button discard"
                    [title]="'Supprimer ' + group.name"
                    [attr.aria-label]="'Supprimer ' + group.name"
                    (click)="remove(group)"
                  >
                    <svg lucideTrash2 [size]="16" aria-hidden="true"></svg>
                  </button>
                }
              </span>
            </div>
          }

          @if (open() === group.id) {
            <div class="details">
              @if (group.isOwner) {
                <p class="note">
                  Le groupe Owner a toutes les permissions et ne contient que le
                  propriétaire : il ne se modifie pas.
                </p>
              }

              <h3>Permissions</h3>
              <ul class="permissions">
                @for (permission of permissions; track permission.id) {
                  <li>
                    <label [title]="permissionHint(group, permission.id)">
                      <input
                        type="checkbox"
                        [checked]="group.permissions.includes(permission.id)"
                        [disabled]="!canToggle(group, permission.id)"
                        (change)="
                          togglePermission(
                            group,
                            permission.id,
                            $any($event.target).checked
                          )
                        "
                      />
                      {{ permission.label }}
                    </label>
                  </li>
                }
              </ul>

              <h3>Membres</h3>
              <ul class="members">
                @for (member of groupMembers(group); track member.userId) {
                  <li class="row">
                    <span class="avatar" aria-hidden="true">{{
                      member.username.slice(0, 2).toUpperCase()
                    }}</span>
                    <span class="name">{{ member.username }}</span>
                    @if (canManageMembers(group)) {
                      <button
                        type="button"
                        class="icon-button discard"
                        [title]="'Retirer ' + member.username + ' du groupe'"
                        [attr.aria-label]="
                          'Retirer ' + member.username + ' du groupe'
                        "
                        (click)="removeMember(group, member)"
                      >
                        <svg lucideX [size]="16" aria-hidden="true"></svg>
                      </button>
                    }
                  </li>
                } @empty {
                  <li class="note">Aucun membre dans ce groupe.</li>
                }
              </ul>

              @if (canManageMembers(group) && candidates(group).length > 0) {
                <form class="add-member" (submit)="addMember($event, group)">
                  <select name="userId" aria-label="Membre à ajouter" required>
                    <option value="">Ajouter un membre…</option>
                    @for (member of candidates(group); track member.userId) {
                      <option [value]="member.userId">
                        {{ member.username }}
                      </option>
                    }
                  </select>
                  <button
                    class="icon-button confirm"
                    title="Ajouter au groupe"
                    aria-label="Ajouter au groupe"
                  >
                    <svg lucidePlus [size]="18" aria-hidden="true"></svg>
                  </button>
                </form>
              }
            </div>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
      max-width: 40rem;
    }

    .groups,
    .permissions,
    .members {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .groups > li {
      border-bottom: 1px solid var(--rule);
    }

    .row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: 3.75rem;
    }

    form.row input {
      flex: 1;
      min-width: 0;
      padding: 0.4rem 0.6rem;
    }

    .toggle {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 0.6rem;
      min-width: 0;
      padding: 0.5rem 0;
      border: 0;
      background: none;
      color: var(--ink);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .toggle svg {
      flex: none;
      color: var(--slate);
    }

    .count {
      color: var(--slate);
      font-size: 0.85rem;
    }

    .details {
      padding: 0 0 1.25rem 1.6rem;
    }

    h3 {
      margin: 1rem 0 0.5rem;
      color: var(--slate);
      font-family: var(--font-body);
      font-size: 0.85rem;
      font-style: normal;
    }

    .permissions {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
      gap: 0.4rem 1rem;
    }

    .permissions label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      cursor: pointer;
    }

    .permissions input {
      accent-color: var(--blue);
    }

    .permissions label:has(input:disabled) {
      color: var(--slate);
      cursor: not-allowed;
    }

    .members .row {
      min-height: 2.75rem;
    }

    .avatar {
      display: grid;
      flex: none;
      place-items: center;
      width: 1.9rem;
      aspect-ratio: 1;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--blue), var(--violet));
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .name {
      flex: 1;
    }

    .add-member {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    select {
      flex: 1;
      min-width: 0;
      padding: 0.45rem 0.6rem;
      border: 2px solid var(--rule);
      border-radius: 0.5rem;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
    }

    .note {
      color: var(--slate);
      font-size: 0.85rem;
    }

    .error {
      margin: 0.5rem 0;
    }
  `,
})
export class OrganizationGroups {
  private readonly http = inject(HttpClient);
  readonly organizationId = input.required<string>();
  readonly myPermissions = input.required<string[]>();
  readonly permissions = PERMISSIONS;
  readonly creating = signal(false);
  readonly renaming = signal<string | null>(null);
  readonly open = signal<string | null>(null);
  readonly error = signal('');
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  private readonly base = computed(
    () => `/api/organizations/${this.organizationId()}`,
  );
  readonly groups = httpResource<Group[]>(() => `${this.base()}/groups`);
  private readonly members = httpResource<Member[]>(
    () => `${this.base()}/members`,
  );
  private readonly usernames = computed(
    () =>
      new Map(
        (this.members.value() ?? []).map(({ userId, username }) => [
          userId,
          username,
        ]),
      ),
  );

  constructor() {
    effect(() => this.field()?.nativeElement.select());
  }

  can(permission: string): boolean {
    return this.myPermissions().includes(permission);
  }

  memberCount(group: Group): string {
    const count = group.memberIds.length;
    return count === 1 ? '1 membre' : `${count} membres`;
  }

  groupMembers(group: Group): Member[] {
    return group.memberIds.map((userId) => ({
      userId,
      username: this.usernames().get(userId) ?? '…',
    }));
  }

  candidates(group: Group): Member[] {
    return (this.members.value() ?? []).filter(
      ({ userId }) => !group.memberIds.includes(userId),
    );
  }

  canManageMembers(group: Group): boolean {
    return !group.isOwner && this.can('MEMBER_MANAGE_GROUPS');
  }

  // On n'accorde que les permissions qu'on possède ; retirer est toujours permis.
  canToggle(group: Group, permission: string): boolean {
    if (group.isOwner || !this.can('GROUP_MANAGE_PERMISSIONS')) return false;
    return group.permissions.includes(permission) || this.can(permission);
  }

  permissionHint(group: Group, permission: string): string {
    if (group.isOwner || this.canToggle(group, permission)) return '';
    return this.can('GROUP_MANAGE_PERMISSIONS')
      ? 'Vous ne pouvez accorder que des permissions que vous possédez'
      : 'Il faut la permission « Gérer les permissions des groupes »';
  }

  toggle(group: Group): void {
    this.open.update((open) => (open === group.id ? null : group.id));
  }

  startCreate(): void {
    this.error.set('');
    this.creating.set(true);
  }

  // Échap annule la saisie sans fermer la modale qui contient la page.
  stopCreate(event?: Event): void {
    event?.preventDefault();
    this.creating.set(false);
  }

  stopRename(event?: Event): void {
    event?.preventDefault();
    this.renaming.set(null);
  }

  create(event: SubmitEvent): void {
    const { name } = formValues(event) as { name: string };
    this.run(this.http.post(`${this.base()}/groups`, { name }), () =>
      this.creating.set(false),
    );
  }

  rename(event: SubmitEvent, group: Group): void {
    const { name } = formValues(event) as { name: string };
    this.run(
      this.http.patch(`${this.base()}/groups/${group.id}`, { name }),
      () => this.renaming.set(null),
    );
  }

  remove(group: Group): void {
    if (!confirm(`Supprimer le groupe ${group.name} ?`)) return;
    this.run(this.http.delete(`${this.base()}/groups/${group.id}`));
  }

  togglePermission(group: Group, permission: string, granted: boolean): void {
    const permissions = granted
      ? [...group.permissions, permission]
      : group.permissions.filter((current) => current !== permission);
    this.run(
      this.http.put(`${this.base()}/groups/${group.id}/permissions`, {
        permissions,
      }),
    );
  }

  addMember(event: SubmitEvent, group: Group): void {
    const { userId } = formValues(event) as { userId: string };
    this.run(
      this.http.put(
        `${this.base()}/groups/${group.id}/members/${userId}`,
        null,
      ),
    );
  }

  removeMember(group: Group, member: Member): void {
    this.run(
      this.http.delete(
        `${this.base()}/groups/${group.id}/members/${member.userId}`,
      ),
    );
  }

  // Chaque action recharge les groupes : l'affichage suit toujours le serveur.
  private run(request: Observable<unknown>, done?: () => void): void {
    this.error.set('');
    request.subscribe({
      next: () => {
        done?.();
        this.groups.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(errorMessage(error));
        this.groups.reload();
      },
    });
  }
}
