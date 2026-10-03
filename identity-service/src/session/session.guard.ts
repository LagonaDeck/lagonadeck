import {
  CanActivate,
  ExecutionContext,
  Injectable,
  createParamDecorator,
} from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { SessionService } from './session.service';
import { bearerToken } from './utils/token.util';

interface AuthenticatedRequest {
  headers: IncomingHttpHeaders;
  userId: string;
}

// Authentifie la requête par le token de session envoyé en `Bearer`.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.sessionService.findUser(
      bearerToken(request.headers.authorization),
    );
    request.userId = user.id;
    return true;
  }
}

export const CurrentUserId = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().userId,
);
