import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

export const USER_ID_HEADER = 'x-user-id';

/**
 * Identifiant de l'utilisateur appelant, transmis par l'API Gateway.
 *
 * TODO(auth) #81: header non signé, falsifiable tant que le port est publié.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const userId = ctx.switchToHttp().getRequest<Request>().headers[
      USER_ID_HEADER
    ];
    if (typeof userId !== 'string' || !isUUID(userId)) {
      throw new UnauthorizedException(
        `Header ${USER_ID_HEADER} absent ou invalide.`,
      );
    }
    return userId;
  },
);
