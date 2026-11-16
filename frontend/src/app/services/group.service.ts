import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Group } from '../models/group';

const groupsUrl = (organizationId: string) =>
  `/api/organizations/${organizationId}/groups`;

/**
 * Groupes d'une organisation. Les méthodes qui renvoient une ressource
 * s'appellent à la construction du component, qui la détruit avec lui.
 */
@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly http = inject(HttpClient);

  groups(organizationId: () => string) {
    return httpResource<Group[]>(() => groupsUrl(organizationId()));
  }

  create(organizationId: string, name: string) {
    return this.http.post(groupsUrl(organizationId), { name });
  }

  rename(organizationId: string, groupId: string, name: string) {
    return this.http.patch(`${groupsUrl(organizationId)}/${groupId}`, {
      name,
    });
  }

  delete(organizationId: string, groupId: string) {
    return this.http.delete(`${groupsUrl(organizationId)}/${groupId}`);
  }

  setPermission(
    organizationId: string,
    group: Group,
    permission: string,
    granted: boolean,
  ) {
    const permissions = granted
      ? [...group.permissions, permission]
      : group.permissions.filter((current) => current !== permission);
    return this.http.put(
      `${groupsUrl(organizationId)}/${group.id}/permissions`,
      { permissions },
    );
  }

  addMember(organizationId: string, groupId: string, userId: string) {
    return this.http.put(
      `${groupsUrl(organizationId)}/${groupId}/members/${userId}`,
      null,
    );
  }

  removeMember(organizationId: string, groupId: string, userId: string) {
    return this.http.delete(
      `${groupsUrl(organizationId)}/${groupId}/members/${userId}`,
    );
  }

  canCreate(permissions: string[]): boolean {
    return permissions.includes('GROUP_CREATE');
  }

  // Le groupe Owner n'est modifiable par aucune route.
  canRename(group: Group, permissions: string[]): boolean {
    return !group.isOwner && permissions.includes('GROUP_UPDATE');
  }

  canDelete(group: Group, permissions: string[]): boolean {
    return !group.isOwner && permissions.includes('GROUP_DELETE');
  }

  canManageMembers(group: Group, permissions: string[]): boolean {
    return !group.isOwner && permissions.includes('MEMBER_MANAGE_GROUPS');
  }

  canEditPermissions(permissions: string[]): boolean {
    return permissions.includes('GROUP_MANAGE_PERMISSIONS');
  }

  // On n'accorde que les permissions qu'on possède ; retirer est toujours permis.
  canToggle(group: Group, permission: string, permissions: string[]): boolean {
    if (group.isOwner || !this.canEditPermissions(permissions)) return false;
    return (
      group.permissions.includes(permission) || permissions.includes(permission)
    );
  }
}
