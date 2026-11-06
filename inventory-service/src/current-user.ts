import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';

// Équipe LagonaDeck : le catalogue est partagé par toutes les organisations.
export const CATALOG_MANAGE = 'CATALOG_MANAGE';

export interface CurrentUser {
  id: string;
  staffPermissions: string[];
}

// La gateway a déjà vérifié la session : elle transmet son utilisateur.
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): CurrentUser => {
    const { headers } = context
      .switchToHttp()
      .getRequest<{ headers: IncomingHttpHeaders }>();
    const id = headers['x-user-id'];
    const staffPermissions = headers['x-staff-permissions'];
    if (typeof id !== 'string') {
      throw new UnauthorizedException('Session invalide');
    }
    return {
      id,
      staffPermissions:
        typeof staffPermissions === 'string' && staffPermissions
          ? staffPermissions.split(',')
          : [],
    };
  },
);

export function requireStaff(user: CurrentUser, permission: string): void {
  if (!user.staffPermissions.includes(permission)) {
    throw new ForbiddenException('Réservé à l’équipe LagonaDeck');
  }
}
