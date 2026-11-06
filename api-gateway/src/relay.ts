import { NotFoundException } from '@nestjs/common';
import type { ServerResponse } from 'node:http';

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

export interface ProxiedRequest {
  method: string;
  url: string;
  body: unknown;
}

export interface CurrentSession {
  sessionId: string;
  user: { id: string; staffPermissions: string[] };
}

export interface FetchInit {
  method?: string;
  body?: unknown;
  token?: string;
  session?: CurrentSession;
}

export const readCookie = (cookies: string | undefined, name: string) =>
  cookies?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];

const sessionHeaders = ({ sessionId, user }: CurrentSession) => ({
  'x-session-id': sessionId,
  'x-user-id': user.id,
  'x-staff-permissions': user.staffPermissions.join(','),
});

// Les services ne croient l'utilisateur transmis (`x-user-id`) que si
// l'appel porte `x-internal-token`.
export function fetchService(
  serviceUrl: string | undefined,
  path: string,
  init: FetchInit = {},
): Promise<Response> {
  return fetch(`${serviceUrl}${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      'x-internal-token': process.env.INTERNAL_TOKEN!,
      ...(init.token && { authorization: `Bearer ${init.token}` }),
      ...(init.session && sessionHeaders(init.session)),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(5000),
  });
}

// La gateway authentifie la session (`authenticate`) ; le service cible
// applique les permissions.
export async function relay(
  req: ProxiedRequest,
  session: CurrentSession,
  res: ServerResponse,
  prefix: string,
  serviceUrl: (pathname: string) => string | undefined,
): Promise<void> {
  // Normalisée comme le ferait `fetch` : un `..` ne doit pas sortir du préfixe.
  const { pathname, search } = new URL(req.url, 'http://gateway');
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    throw new NotFoundException();
  }

  const response = await fetchService(serviceUrl(pathname), pathname + search, {
    method: req.method,
    body: METHODS_WITH_BODY.has(req.method) ? req.body : undefined,
    session,
  });
  res.statusCode = response.status;
  const contentType = response.headers.get('content-type');
  if (contentType) res.setHeader('content-type', contentType);
  res.end(await response.text());
}
