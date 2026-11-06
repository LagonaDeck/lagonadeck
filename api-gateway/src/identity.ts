import { HttpException, UnauthorizedException } from '@nestjs/common';
import {
  fetchService,
  readCookie,
  type CurrentSession,
  type FetchInit,
} from './relay';

export const fetchIdentity = (
  path: string,
  init: FetchInit = {},
): Promise<Response> =>
  fetchService(process.env.IDENTITY_SERVICE_URL, path, init);

// Les erreurs d'identity (400, 401, 409) sont renvoyées telles quelles : la
// validation ne vit qu'à un seul endroit.
export async function callIdentity<T>(
  path: string,
  init: FetchInit = {},
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

// Seul endroit où le token de session est vérifié : les services reçoivent
// l'utilisateur qu'il désigne, jamais le token.
export async function authenticate(
  cookies: string | undefined,
): Promise<CurrentSession> {
  const token = readCookie(cookies, 'session');
  if (!token) throw new UnauthorizedException('Session invalide');
  return callIdentity('/api/sessions/current', { token });
}
