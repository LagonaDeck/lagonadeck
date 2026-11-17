import {
  ExecutionContext,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';

// La gateway a déjà vérifié la session : elle transmet son utilisateur.
export const CurrentUserId = createParamDecorator(
  (_: unknown, context: ExecutionContext): string => {
    const id = context
      .switchToHttp()
      .getRequest<{ headers: IncomingHttpHeaders }>().headers['x-user-id'];
    if (typeof id !== 'string') {
      throw new UnauthorizedException('Session invalide');
    }
    return id;
  },
);
