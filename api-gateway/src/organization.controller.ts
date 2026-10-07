import {
  All,
  Controller,
  Headers,
  NotFoundException,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { fetchIdentity, readCookie } from './identity';

const IDENTITY_PREFIX = '/api/organizations';
const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

interface ProxiedRequest {
  method: string;
  url: string;
  body: unknown;
}

// Relais sans logique : identity authentifie le token et applique les
// permissions, la gateway n'ajoute aucune règle.
@Controller('organizations')
export class OrganizationController {
  @All(['', '*path'])
  async forward(
    @Req() req: ProxiedRequest,
    @Headers('cookie') cookies: string | undefined,
    @Res() res: ServerResponse,
  ): Promise<void> {
    const token = readCookie(cookies, 'session');
    if (!token) throw new UnauthorizedException('Session invalide');

    // Normalisée comme le ferait `fetch` : un `..` ne doit pas sortir du préfixe.
    const { pathname, search } = new URL(req.url, 'http://gateway');
    if (
      pathname !== IDENTITY_PREFIX &&
      !pathname.startsWith(`${IDENTITY_PREFIX}/`)
    ) {
      throw new NotFoundException();
    }

    const response = await fetchIdentity(pathname + search, {
      method: req.method,
      body: METHODS_WITH_BODY.has(req.method) ? req.body : undefined,
      token,
    });
    res.statusCode = response.status;
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    res.end(await response.text());
  }
}
