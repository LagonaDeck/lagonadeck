import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';

interface AuthenticatedRequest {
  headers: IncomingHttpHeaders;
  userId: string;
}

function header(context: ExecutionContext, name: string): string {
  const value = context.switchToHttp().getRequest<AuthenticatedRequest>()
    .headers[name];
  if (typeof value !== 'string') {
    throw new UnauthorizedException('Session invalide');
  }
  return value;
}

// La gateway a déjà vérifié la session : elle transmet l'utilisateur en
// `x-user-id`, et l'id de la session en `x-session-id`.
@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest<AuthenticatedRequest>().userId = header(
      context,
      'x-user-id',
    );
    return true;
  }
}

export const CurrentUserId = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().userId,
);

export const CurrentSessionId = createParamDecorator(
  (_: unknown, context: ExecutionContext) => header(context, 'x-session-id'),
);
