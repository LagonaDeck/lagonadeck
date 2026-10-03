import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
const MAX_TRACKED_EMAILS = 10_000;

interface Failures {
  count: number;
  until: number;
}

// En mémoire : suffit tant qu'identity tourne en une seule instance.
// TODO: passer sur un stockage partagé (Redis) si identity est répliqué.
@Injectable()
export class LoginThrottleService {
  private readonly failures = new Map<string, Failures>();

  // Bloque même avec le bon mot de passe : sinon on devinerait par élimination.
  assertAllowed(email: string, now = Date.now()): void {
    const entry = this.failures.get(email);
    if (entry && entry.until > now && entry.count >= MAX_LOGIN_FAILURES) {
      throw new HttpException(
        'Trop de tentatives de connexion, réessayez dans 15 minutes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(email: string, now = Date.now()): void {
    const entry = this.failures.get(email);
    if (entry && entry.until > now) entry.count += 1;
    else this.failures.set(email, { count: 1, until: now + LOGIN_LOCK_MS });

    // Des emails inventés ne doivent pas faire grossir la Map sans fin.
    if (this.failures.size > MAX_TRACKED_EMAILS) {
      for (const [key, { until }] of this.failures) {
        if (until <= now) this.failures.delete(key);
      }
    }
  }

  reset(email: string): void {
    this.failures.delete(email);
  }
}
