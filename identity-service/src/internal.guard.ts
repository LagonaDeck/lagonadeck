import {
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

const digest = (value: string) => createHash('sha256').update(value).digest();

// L'utilisateur transmis en `x-user-id` n'est cru que d'un appelant interne
// (la gateway, un autre service) : il prouve qu'il en est un par ce secret.
export class InternalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = context
      .switchToHttp()
      .getRequest<{ headers: IncomingHttpHeaders }>().headers[
      'x-internal-token'
    ];
    if (
      typeof token !== 'string' ||
      !timingSafeEqual(digest(token), digest(process.env.INTERNAL_TOKEN!))
    ) {
      throw new UnauthorizedException('Appel interne refusé');
    }
    return true;
  }
}
