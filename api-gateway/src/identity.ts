import { HttpException } from '@nestjs/common';
import { fetchService } from './relay';

export const fetchIdentity = (
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<Response> =>
  fetchService(process.env.IDENTITY_SERVICE_URL, path, init);

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
