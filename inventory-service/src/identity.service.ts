import {
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

export const INVENTORY_MANAGE = 'INVENTORY_MANAGE';
// Équipe LagonaDeck : le catalogue est partagé par toutes les organisations.
export const CATALOG_MANAGE = 'CATALOG_MANAGE';

export interface CurrentUser {
  id: string;
  staffPermissions: string[];
}

// Les sessions et les permissions vivent dans identity : ce service lui
// transmet le token tel quel et renvoie ses erreurs (401, 404) sans les réécrire.
@Injectable()
export class IdentityService {
  requireSession(authorization: string | undefined): Promise<CurrentUser> {
    return this.call<CurrentUser>('/api/sessions/current', authorization);
  }

  async requireStaff(
    authorization: string | undefined,
    permission: string,
  ): Promise<CurrentUser> {
    const user = await this.requireSession(authorization);
    if (!user.staffPermissions.includes(permission)) {
      throw new ForbiddenException('Réservé à l’équipe LagonaDeck');
    }
    return user;
  }

  async getPermissions(
    authorization: string | undefined,
    organizationId: string,
  ): Promise<string[]> {
    const { permissions } = await this.call<{ permissions: string[] }>(
      `/api/organizations/${organizationId}/me`,
      authorization,
    );
    return permissions;
  }

  async requirePermission(
    authorization: string | undefined,
    organizationId: string,
    permission: string,
  ): Promise<void> {
    const permissions = await this.getPermissions(
      authorization,
      organizationId,
    );
    if (!permissions.includes(permission)) {
      throw new ForbiddenException('Permission insuffisante');
    }
  }

  private async call<T>(
    path: string,
    authorization: string | undefined,
  ): Promise<T> {
    if (!authorization) throw new UnauthorizedException('Session invalide');
    const response = await fetch(`${process.env.IDENTITY_SERVICE_URL}${path}`, {
      headers: { authorization },
      signal: AbortSignal.timeout(5000),
    });
    const payload = (await response.json()) as T;
    if (!response.ok) {
      throw new HttpException(payload as object, response.status);
    }
    return payload;
  }
}
