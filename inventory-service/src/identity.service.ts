import { ForbiddenException, HttpException, Injectable } from '@nestjs/common';

export const INVENTORY_MANAGE = 'INVENTORY_MANAGE';

// Les permissions vivent dans identity : ses erreurs (404, 403) sont renvoyées
// sans les réécrire.
@Injectable()
export class IdentityService {
  async getPermissions(
    userId: string,
    organizationId: string,
  ): Promise<string[]> {
    const { permissions } = await this.call<{ permissions: string[] }>(
      `/api/organizations/${organizationId}/me`,
      userId,
    );
    return permissions;
  }

  async requirePermission(
    userId: string,
    organizationId: string,
    permission: string,
  ): Promise<void> {
    const permissions = await this.getPermissions(userId, organizationId);
    if (!permissions.includes(permission)) {
      throw new ForbiddenException('Permission insuffisante');
    }
  }

  private async call<T>(path: string, userId: string): Promise<T> {
    const response = await fetch(`${process.env.IDENTITY_SERVICE_URL}${path}`, {
      headers: {
        'x-internal-token': process.env.INTERNAL_TOKEN!,
        'x-user-id': userId,
      },
      signal: AbortSignal.timeout(5000),
    });
    const payload = (await response.json()) as T;
    if (!response.ok) {
      throw new HttpException(payload as object, response.status);
    }
    return payload;
  }
}
