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
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  LucideCrown,
  LucideKeyRound,
  LucideLogOut,
  LucidePlus,
  LucideSearch,
  LucideUserMinus,
  LucideUserPlus,
  LucideX,
} from '@lucide/angular';
import { Auth, errorMessage } from './auth';
import { Organizations } from './organizations';

interface Member {
  userId: string;
  username: string;
  isOwner: boolean;
  groups: { id: string; name: string }[];
}

// Un compte invité (`userId`, `username`) ou une adresse sans compte (`email`).
interface PendingInvitation {
  userId?: string;
  username?: string;
  email?: string;
  createdAt: string;
}

interface InvitableUser {
  id: string;
  username: string;
  email: string;
  invited: boolean;
}

const SEARCH_DELAY_MS = 250;

const initials = (username: string) => username.slice(0, 2).toUpperCase();

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

@Component({
  selector: 'app-organization-members',
  imports: [
    LucideCrown,
    LucideKeyRound,
    LucideLogOut,
    LucidePlus,
    LucideSearch,
    LucideUserMinus,
    LucideUserPlus,
    LucideX,
  ],
  template: `
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <div class="section-header">
      <h2>Membres</h2>
      @if (canInvite() && !searching()) {
        <button type="button" class="small-button" (click)="openSearch()">
          <svg lucideUserPlus [size]="16" aria-hidden="true"></svg>
          Inviter un membre
        </button>
      }
    </div>

    @if (searching()) {
      <div class="search-box">
        <div class="search">
          <svg lucideSearch [size]="18" aria-hidden="true"></svg>
          <input
            type="text"
            aria-label="Email ou nom d’utilisateur"
            placeholder="Email ou nom d’utilisateur"
            autocomplete="off"
            (input)="search($any($event.target).value)"
            (keydown.escape)="closeSearch($event)"
            #searchField
          />
          <button
            type="button"
            class="icon-button"
            title="Fermer la recherche"
            aria-label="Fermer la recherche"
            (click)="closeSearch()"
          >
            <svg lucideX [size]="18" aria-hidden="true"></svg>
          </button>
        </div>
        @if (query().length > 0) {
          <ul class="list results" aria-label="Résultats de la recherche">
            @for (user of results.value() ?? []; track user.id) {
              <li class="row">
                <span class="avatar" aria-hidden="true">{{
                  initials(user.username)
                }}</span>
                <span class="identity">
                  <strong>{{ user.username }}</strong>
                  <span>{{ user.email }}</span>
                </span>
                @if (user.invited) {
                  <span class="tag">Invitation envoyée</span>
                } @else {
                  <button
                    type="button"
                    class="icon-button invite"
                    [title]="'Inviter ' + user.username"
                    [attr.aria-label]="'Inviter ' + user.username"
                    (click)="invite(user)"
                  >
                    <svg lucidePlus [size]="18" aria-hidden="true"></svg>
                  </button>
                }
              </li>
            } @empty {
              @if (results.isLoading()) {
                <li class="empty">Recherche…</li>
              } @else if (isEmail(query())) {
                <li class="row">
                  <span class="avatar pending" aria-hidden="true">{{
                    initials(query())
                  }}</span>
                  <span class="identity">
                    <strong>{{ query() }}</strong>
                    <span>Pas encore de compte LagonaDeck</span>
                  </span>
                  <button
                    type="button"
                    class="icon-button invite"
                    [title]="'Inviter ' + query() + ' à rejoindre LagonaDeck'"
                    [attr.aria-label]="
                      'Inviter ' + query() + ' à rejoindre LagonaDeck'
                    "
                    (click)="inviteEmail(query())"
                  >
                    <svg lucidePlus [size]="18" aria-hidden="true"></svg>
                  </button>
                </li>
              } @else {
                <li class="empty">
                  Aucun compte trouvé. Saisissez l’email exact ou au moins 3
                  lettres du nom d’utilisateur.
                </li>
              }
            }
          </ul>
        }
      </div>
    }

    <ul class="list">
      @for (member of members.value() ?? []; track member.userId) {
        <li class="row">
          <span class="avatar" aria-hidden="true">{{
            initials(member.username)
          }}</span>
          <span class="identity">
            <strong>{{ member.username }}</strong>
            <span>{{ groupNames(member) }}</span>
          </span>
          <span class="row-actions">
            @if (member.isOwner) {
              <span class="owner" title="Propriétaire">
                <svg lucideCrown [size]="16" aria-hidden="true"></svg>
                <span class="visually-hidden">Propriétaire</span>
              </span>
            } @else if (isMe(member)) {
              <button
                type="button"
                class="icon-button discard"
                title="Quitter l’organisation"
                aria-label="Quitter l’organisation"
                (click)="leave(member)"
              >
                <svg lucideLogOut [size]="16" aria-hidden="true"></svg>
              </button>
            } @else {
              @if (isOwner()) {
                <button
                  type="button"
                  class="icon-button"
                  [title]="'Transférer la propriété à ' + member.username"
                  [attr.aria-label]="
                    'Transférer la propriété à ' + member.username
                  "
                  (click)="transfer(member)"
                >
                  <svg lucideKeyRound [size]="16" aria-hidden="true"></svg>
                </button>
              }
              @if (canRemove()) {
                <button
                  type="button"
                  class="icon-button discard"
                  [title]="'Retirer ' + member.username"
                  [attr.aria-label]="'Retirer ' + member.username"
                  (click)="remove(member)"
                >
                  <svg lucideUserMinus [size]="16" aria-hidden="true"></svg>
                </button>
              }
            }
          </span>
        </li>
      }
    </ul>

    @if ((pending.value() ?? []).length > 0) {
      <h2>Invitations en attente</h2>
      <ul class="list">
        @for (
          invitation of pending.value() ?? [];
          track invitation.userId ?? invitation.email
        ) {
          <li class="row">
            <span class="avatar pending" aria-hidden="true">{{
              initials(invitedName(invitation))
            }}</span>
            <span class="identity">
              <strong>{{ invitedName(invitation) }}</strong>
              <span>
                @if (invitation.email) {
                  Invitation à rejoindre LagonaDeck, le
                } @else {
                  Invitation envoyée le
                }
                {{ date(invitation.createdAt) }}
              </span>
            </span>
            <span class="row-actions">
              @if (canInvite()) {
                <button
                  type="button"
                  class="icon-button discard"
                  [title]="'Annuler l’invitation de ' + invitedName(invitation)"
                  [attr.aria-label]="
                    'Annuler l’invitation de ' + invitedName(invitation)
                  "
                  (click)="revoke(invitation)"
                >
                  <svg lucideX [size]="16" aria-hidden="true"></svg>
                </button>
              }
            </span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 40rem;
    }

    h2 {
      margin: 1.5rem 0 0.25rem;
      font-size: 1.15rem;
    }

    .search {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--slate);
    }

    .search input {
      flex: 1;
      min-width: 0;
      padding: 0.5rem 0.75rem;
    }

    .list {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: 3.75rem;
      border-bottom: 1px solid var(--rule);
    }

    /* Menu déroulant posé sur la liste : les comptes trouvés ne se
       confondent pas avec les membres. */
    .search-box {
      position: relative;
    }

    .results {
      position: absolute;
      top: calc(100% + 0.35rem);
      right: 2.5rem;
      left: 1.6rem;
      z-index: 10;
      padding: 0.35rem;
      border: 1px solid var(--rule);
      border-radius: 0.75rem;
      background: var(--surface);
      box-shadow: 0 12px 28px -12px var(--shadow);
    }

    .results .row {
      min-height: 3rem;
      padding-inline: 0.5rem;
      border-bottom: 0;
      border-radius: 0.5rem;
    }

    .results .row:hover {
      background: var(--hover);
    }

    .avatar {
      display: grid;
      flex: none;
      place-items: center;
      width: 2.25rem;
      aspect-ratio: 1;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--blue), var(--violet));
      color: #fff;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .avatar.pending {
      background: var(--rule);
      color: var(--slate);
    }

    .identity {
      display: grid;
      flex: 1;
      min-width: 0;
    }

    .identity span {
      overflow: hidden;
      color: var(--slate);
      font-size: 0.85rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .owner {
      display: grid;
      place-items: center;
      width: 2rem;
      color: var(--gold);
    }

    .icon-button.invite,
    .icon-button.invite:hover {
      color: var(--blue);
    }

    .icon-button.invite:hover {
      background: color-mix(in srgb, var(--blue) 12%, transparent);
    }

    .tag {
      color: var(--slate);
      font-size: 0.85rem;
    }

    .empty {
      padding: 0.75rem 0.5rem;
      color: var(--slate);
      font-size: 0.9rem;
    }

    .error {
      margin-top: 1rem;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class OrganizationMembers {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly organizations = inject(Organizations);
  readonly organizationId = input.required<string>();
  readonly permissions = input.required<string[]>();
  readonly isOwner = input.required<boolean>();
  readonly ownershipTransferred = output();
  readonly initials = initials;
  readonly isEmail = isEmail;
  readonly searching = signal(false);
  readonly query = signal('');
  readonly error = signal('');
  private searchTimer?: ReturnType<typeof setTimeout>;
  private readonly searchField =
    viewChild<ElementRef<HTMLInputElement>>('searchField');

  constructor() {
    effect(() => this.searchField()?.nativeElement.focus());
  }

  readonly canInvite = computed(() =>
    this.permissions().includes('MEMBER_INVITE'),
  );
  readonly canRemove = computed(() =>
    this.permissions().includes('MEMBER_REMOVE'),
  );

  private readonly base = computed(
    () => `/api/organizations/${this.organizationId()}`,
  );
  readonly members = httpResource<Member[]>(() => `${this.base()}/members`);
  readonly pending = httpResource<PendingInvitation[]>(() =>
    this.canInvite() ? `${this.base()}/invitations` : undefined,
  );
  readonly results = httpResource<InvitableUser[]>(() =>
    this.query()
      ? {
          url: `${this.base()}/invitable-users`,
          params: { q: this.query() },
        }
      : undefined,
  );

  groupNames(member: Member): string {
    return member.groups.map(({ name }) => name).join(', ') || 'Aucun groupe';
  }

  date(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-CH');
  }

  openSearch(): void {
    this.error.set('');
    this.searching.set(true);
  }

  // Échap ferme la recherche sans fermer la modale qui contient la page.
  closeSearch(event?: Event): void {
    event?.preventDefault();
    clearTimeout(this.searchTimer);
    this.query.set('');
    this.searching.set(false);
  }

  // Attend une courte pause dans la saisie avant d'interroger le serveur.
  search(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(
      () => this.query.set(value.trim()),
      SEARCH_DELAY_MS,
    );
  }

  invite(user: InvitableUser): void {
    this.run(
      this.http.post(`${this.base()}/invitations`, { userId: user.id }),
      () => {
        this.closeSearch();
        this.pending.reload();
      },
    );
  }

  invitedName(invitation: PendingInvitation): string {
    return invitation.username ?? invitation.email ?? '';
  }

  // L'email est envoyé par le futur service de notifications ; d'ici là,
  // l'invitation attend la création du compte avec cette adresse.
  inviteEmail(email: string): void {
    this.run(
      this.http.post(`${this.base()}/email-invitations`, { email }),
      () => {
        this.closeSearch();
        this.pending.reload();
      },
    );
  }

  revoke(invitation: PendingInvitation): void {
    const path = invitation.userId
      ? `invitations/${invitation.userId}`
      : `email-invitations/${encodeURIComponent(invitation.email ?? '')}`;
    this.run(this.http.delete(`${this.base()}/${path}`), () =>
      this.pending.reload(),
    );
  }

  isMe(member: Member): boolean {
    return member.userId === this.auth.user()?.id;
  }

  // TODO: le destinataire acceptera ou refusera par notification ; d'ici là,
  // le transfert s'applique tout de suite.
  transfer(member: Member): void {
    const question = `Transférer la propriété de l’organisation à ${member.username} ? Vous resterez membre, sans permission.`;
    if (!confirm(question)) return;
    this.run(
      this.http.post(`${this.base()}/transfer-ownership`, {
        userId: member.userId,
      }),
      () => {
        this.members.reload();
        this.organizations.load().subscribe();
        this.ownershipTransferred.emit();
      },
    );
  }

  remove(member: Member): void {
    if (!confirm(`Retirer ${member.username} de l’organisation ?`)) return;
    this.run(this.http.delete(`${this.base()}/members/${member.userId}`), () =>
      this.members.reload(),
    );
  }

  // Après le départ, l'organisation disparaît de la liste : la modale passe à
  // l'organisation courante.
  leave(member: Member): void {
    if (!confirm('Quitter cette organisation ?')) return;
    this.run(this.http.delete(`${this.base()}/members/${member.userId}`), () =>
      this.organizations.load().subscribe(),
    );
  }

  private run(
    request: ReturnType<HttpClient['delete']>,
    done: () => void,
  ): void {
    this.error.set('');
    request.subscribe({
      next: done,
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }
}
