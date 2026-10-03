import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';

export interface Organization {
  id: string;
  name: string;
  plan: string;
  groups: string[];
}

const CURRENT_KEY = 'current-organization';

@Injectable({ providedIn: 'root' })
export class Organizations {
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

export function organizationInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words.at(-1)?.[0] ?? '')).toUpperCase();
}

const PLAN_LABELS: Record<string, string> = { DISCOVERY: 'Découverte' };

export const planLabel = (plan: string): string => PLAN_LABELS[plan] ?? plan;

export const roleLabel = (organization: Organization): string =>
  organization.groups.join(', ') || 'Aucun groupe';
