import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { errorMessage } from './auth';
import { Organization, Organizations } from './organizations';

interface ReceivedInvitation {
  organizationId: string;
  organizationName: string;
  invitedBy: string;
}

@Component({
  selector: 'app-invitations',
  template: `
    <h1>Invitations</h1>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <ul class="invitations">
      @for (
        invitation of invitations.value() ?? [];
        track invitation.organizationId
      ) {
        <li class="panel">
          <span>
            <strong>{{ invitation.organizationName }}</strong>
            <span class="hint">Invitation de {{ invitation.invitedBy }}</span>
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
  `,
  styles: `
    :host {
      display: grid;
      gap: 1rem;
      max-width: 48rem;
    }

    h1 {
      font-size: clamp(1.75rem, 3vw, 2.25rem);
    }

    .invitations {
      display: grid;
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .panel {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border: 1px solid var(--rule);
      border-radius: 0.75rem;
      background: var(--surface);
    }

    .panel > span:first-child {
      display: grid;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
  `,
})
export class Invitations {
  private readonly http = inject(HttpClient);
  private readonly organizations = inject(Organizations);
  readonly error = signal('');

  readonly invitations = httpResource<ReceivedInvitation[]>(
    () => '/api/organizations/invitations',
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
