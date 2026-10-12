import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ServerResponse } from 'node:http';

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

export interface ProxiedRequest {
  method: string;
  url: string;
  body: unknown;
}

export const readCookie = (cookies: string | undefined, name: string) =>
  cookies?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];

export function fetchService(
  serviceUrl: string | undefined,
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<Response> {
  return fetch(`${serviceUrl}${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      ...(init.token && { authorization: `Bearer ${init.token}` }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(5000),
  });
}

// Relais sans logique : le service cible authentifie le token et applique les
// permissions, la gateway n'ajoute aucune règle.
export async function relay(
  req: ProxiedRequest,
  cookies: string | undefined,
  res: ServerResponse,
  prefix: string,
  serviceUrl: (pathname: string) => string | undefined,
): Promise<void> {
  const token = readCookie(cookies, 'session');
  if (!token) throw new UnauthorizedException('Session invalide');

  // Normalisée comme le ferait `fetch` : un `..` ne doit pas sortir du préfixe.
  const { pathname, search } = new URL(req.url, 'http://gateway');
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    throw new NotFoundException();
  }

  const response = await fetchService(serviceUrl(pathname), pathname + search, {
    method: req.method,
    body: METHODS_WITH_BODY.has(req.method) ? req.body : undefined,
    token,
  });
  res.statusCode = response.status;
  const contentType = response.headers.get('content-type');
  if (contentType) res.setHeader('content-type', contentType);
  res.end(await response.text());
}
