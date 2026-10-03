import { UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

export const generateToken = (): string =>
  randomBytes(32).toString('base64url');

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export function bearerToken(authorization: string | undefined): string {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new UnauthorizedException('Session invalide');
  return token;
}
