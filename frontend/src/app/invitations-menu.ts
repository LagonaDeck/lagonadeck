import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { LucideBell } from '@lucide/angular';
import { errorMessage } from './auth';
import { Organization, Organizations } from './organizations';

interface ReceivedInvitation {
  organizationId: string;
  organizationName: string;
  invitedBy: string;
}

// Les invitations sont rares : une cloche dans la barre du haut les signale
// sans occuper une entrée du menu.
@Component({
  selector: 'app-invitations-menu',
  imports: [LucideBell],
  template: `
    <details #menu (toggle)="menu.open && invitations.reload()">
      <summary
        class="icon-button"
        [title]="label()"
        [attr.aria-label]="label()"
      >
        <svg lucideBell [size]="20" aria-hidden="true"></svg>
        @if (count()) {
          <span class="badge" aria-hidden="true">{{ count() }}</span>
        }
      </summary>
      <div class="menu">
        <p class="title">Invitations</p>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <ul>
          @for (
            invitation of invitations.value() ?? [];
            track invitation.organizationId
          ) {
            <li>
              <span>
                <strong>{{ invitation.organizationName }}</strong>
                <span class="hint"
                  >Invitation de {{ invitation.invitedBy }}</span
                >
              </span>
              <span class="actions">
                <button
                  type="button"
                  class="small-button"
                  (click)="accept(invitation)"
                >
                  Rejoindre
                </button>
                <button
                  type="button"
                  class="link-button"
                  (click)="decline(invitation)"
                >
                  Refuser
                </button>
              </span>
            </li>
          } @empty {
            <li class="hint">
              {{
                invitations.isLoading()
                  ? 'Chargement…'
                  : 'Aucune invitation en attente.'
              }}
            </li>
          }
        </ul>
      </div>
    </details>
  `,
  styles: `
    details {
      position: relative;
    }

    summary {
      position: relative;
      width: 2.5rem;
      list-style: none;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    details[open] summary {
      background: var(--hover);
      color: var(--ink);
    }

    .badge {
      position: absolute;
      top: 0.1rem;
      right: 0.1rem;
      display: grid;
      place-items: center;
      min-width: 1.1rem;
      height: 1.1rem;
      padding-inline: 0.25rem;
      border-radius: 999px;
      background: var(--blue);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .menu {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      z-index: 10;
      width: min(22rem, calc(100vw - 2rem));
      border: 1px solid var(--rule);
      border-radius: 0.75rem;
      background: var(--surface);
      box-shadow: 0 12px 28px -12px var(--shadow);
    }

    .title {
      margin: 0;
      padding: 0.85rem 1rem;
      font-weight: 700;
    }

    .error {
      margin: 0 1rem 0.75rem;
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-top: 1px solid var(--rule);
    }

    li > span:first-child {
      display: grid;
      min-width: 0;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
  `,
})
export class InvitationsMenu {
  private readonly http = inject(HttpClient);
  private readonly organizations = inject(Organizations);
  readonly error = signal('');

  readonly invitations = httpResource<ReceivedInvitation[]>(
    () => '/api/organizations/invitations',
  );
  readonly count = computed(() => this.invitations.value()?.length ?? 0);
  readonly label = computed(() =>
    this.count() ? `Invitations (${this.count()} en attente)` : 'Invitations',
  );

  accept({ organizationId }: ReceivedInvitation): void {
    this.error.set('');
    this.http
      .post<Organization>(
        `/api/organizations/invitations/${organizationId}/accept`,
        null,
      )
      .subscribe({
        next: (organization) => {
          this.organizations.list.update((list) => [...list, organization]);
          this.organizations.select(organization.id);
          this.invitations.reload();
        },
        error: (error: HttpErrorResponse) =>
          this.error.set(errorMessage(error)),
      });
  }

  decline({ organizationId }: ReceivedInvitation): void {
    this.error.set('');
    this.http
      .delete(`/api/organizations/invitations/${organizationId}`)
      .subscribe({
        next: () => this.invitations.reload(),
        error: (error: HttpErrorResponse) =>
          this.error.set(errorMessage(error)),
      });
  }
}
