import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { PendingInvitation, ReceivedInvitation } from '../models/invitation';
import { InvitableUser } from '../models/user';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invitations reçues par l'utilisateur et invitations envoyées par une
 * organisation. Les méthodes qui renvoient une ressource s'appellent à la
 * construction du component, qui la détruit avec lui.
 */
@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly http = inject(HttpClient);

  received() {
    return httpResource<ReceivedInvitation[]>(
      () => '/api/organizations/invitations',
    );
  }

  decline(organizationId: string) {
    return this.http.delete(`/api/organizations/invitations/${organizationId}`);
  }

  pending(organizationId: () => string | undefined) {
    return httpResource<PendingInvitation[]>(() => {
      const id = organizationId();
      return id ? `/api/organizations/${id}/invitations` : undefined;
    });
  }

  invitableUsers(organizationId: () => string, query: () => string) {
    return httpResource<InvitableUser[]>(() =>
      query()
        ? {
            url: `/api/organizations/${organizationId()}/invitable-users`,
            params: { q: query() },
          }
        : undefined,
    );
  }

  invite(organizationId: string, userId: string) {
    return this.http.post(`/api/organizations/${organizationId}/invitations`, {
      userId,
    });
  }

  // Une adresse sans compte reçoit l'invitation par email : elle devient une
  // invitation à la création du compte avec cette adresse.
  inviteByEmail(organizationId: string, email: string) {
    return this.http.post(
      `/api/organizations/${organizationId}/email-invitations`,
      { email },
    );
  }

  revoke(organizationId: string, invitation: PendingInvitation) {
    const path = invitation.userId
      ? `invitations/${invitation.userId}`
      : `email-invitations/${encodeURIComponent(invitation.email ?? '')}`;
    return this.http.delete(`/api/organizations/${organizationId}/${path}`);
  }

  canInvite(permissions: string[]): boolean {
    return permissions.includes('MEMBER_INVITE');
  }

  isEmail(value: string): boolean {
    return EMAIL.test(value);
  }
}
