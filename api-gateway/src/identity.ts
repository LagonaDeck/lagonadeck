import { HttpException } from '@nestjs/common';

export function fetchIdentity(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<Response> {
  return fetch(`${process.env.IDENTITY_SERVICE_URL}${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      ...(init.token && { authorization: `Bearer ${init.token}` }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(5000),
  });
}

// Les erreurs d'identity (400, 401, 409) sont renvoyées telles quelles : la
// validation ne vit qu'à un seul endroit.
export async function callIdentity<T>(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const response = await fetchIdentity(path, init);
  const payload = (
    response.status === 204 ? undefined : await response.json()
  ) as T;
  if (!response.ok) {
    throw new HttpException(payload as object, response.status);
  }
  return payload;
}

export const readCookie = (cookies: string | undefined, name: string) =>
  cookies?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];
