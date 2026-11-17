import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Member } from '../models/member';

/**
 * Membres d'une organisation. Les méthodes qui renvoient une ressource
 * s'appellent à la construction du component, qui la détruit avec lui.
 */
@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly http = inject(HttpClient);

  members(organizationId: () => string) {
    return httpResource<Member[]>(
      () => `/api/organizations/${organizationId()}/members`,
    );
  }

  canRemove(permissions: string[]): boolean {
    return permissions.includes('MEMBER_REMOVE');
  }

  // Retirer un membre et quitter l'organisation passent par la même route.
  remove(organizationId: string, userId: string) {
    return this.http.delete(
      `/api/organizations/${organizationId}/members/${userId}`,
    );
  }
}
