import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap, throwError } from 'rxjs';
import { Organization } from '../models/organization';

const CURRENT_KEY = 'current-organization';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly currentId = signal(readStored());
  readonly list = signal<Organization[]>([]);
  // Retombe sur la première si l'organisation mémorisée n'est plus accessible.
  readonly current = computed<Organization | undefined>(
    () =>
      this.list().find(({ id }) => id === this.currentId()) ?? this.list()[0],
  );

  load() {
    return this.http
      .get<Organization[]>('/api/organizations')
      .pipe(tap((organizations) => this.list.set(organizations)));
  }

  /** URL d'une ressource de l'organisation courante, vide sans organisation. */
  currentUrl(path: string) {
    return computed(() => {
      const organization = this.current();
      return organization
        ? `/api/organizations/${organization.id}/${path}`
        : '';
    });
  }

  // Sans organisation courante, une écriture échoue au lieu de partir vers une URL vide.
  noCurrent() {
    return throwError(() => new Error('Aucune organisation sélectionnée.'));
  }

  // Ne sert qu'à afficher ou masquer les actions : le serveur contrôle chaque appel.
  access(organizationId: () => string | undefined) {
    return httpResource<{ permissions: string[] }>(() => {
      const id = organizationId();
      return id ? `/api/organizations/${id}/me` : undefined;
    });
  }

  /** Vrai quand l'utilisateur a cette permission dans l'organisation courante. */
  can(permission: string) {
    const access = this.access(() => this.current()?.id);
    return computed(
      () =>
        access.hasValue() && access.value().permissions.includes(permission),
    );
  }

  canManage(permissions: string[]): boolean {
    return permissions.includes('ORGANIZATION_MANAGE');
  }

  // Le groupe Owner ne se renomme pas : son nom identifie le propriétaire.
  isOwner(organization: Organization): boolean {
    return organization.groups.includes('Owner');
  }

  create(name: string) {
    return this.http
      .post<Organization>('/api/organizations', { name })
      .pipe(
        tap((organization) =>
          this.list.update((organizations) => [...organizations, organization]),
        ),
      );
  }

  rename(id: string, name: string) {
    return this.http
      .patch<Organization>(`/api/organizations/${id}`, { name })
      .pipe(
        tap((renamed) =>
          this.list.update((organizations) =>
            organizations.map((organization) =>
              organization.id === id
                ? { ...organization, name: renamed.name }
                : organization,
            ),
          ),
        ),
      );
  }

  delete(id: string) {
    return this.http
      .delete<void>(`/api/organizations/${id}`)
      .pipe(
        tap(() =>
          this.list.update((organizations) =>
            organizations.filter((organization) => organization.id !== id),
          ),
        ),
      );
  }

  acceptInvitation(organizationId: string) {
    return this.http
      .post<Organization>(
        `/api/organizations/invitations/${organizationId}/accept`,
        null,
      )
      .pipe(
        tap((organization) => {
          this.list.update((organizations) => [...organizations, organization]);
          this.select(organization.id);
        }),
      );
  }

  transferOwnership(organizationId: string, userId: string) {
    return this.http.post(
      `/api/organizations/${organizationId}/transfer-ownership`,
      { userId },
    );
  }

  select(id: string): void {
    this.currentId.set(id);
    try {
      localStorage.setItem(CURRENT_KEY, id);
    } catch {
      // Stockage indisponible : le choix ne survit pas au rechargement.
    }
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}
