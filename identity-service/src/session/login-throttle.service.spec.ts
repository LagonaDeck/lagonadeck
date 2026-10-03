import { HttpException } from '@nestjs/common';
import {
  LOGIN_LOCK_MS,
  LoginThrottleService,
  MAX_LOGIN_FAILURES,
} from './login-throttle.service';

describe('LoginThrottleService', () => {
  const email = 'jane@example.com';
  let throttle: LoginThrottleService;

  const fail = (times: number, now = 0) => {
    for (let i = 0; i < times; i++) throttle.recordFailure(email, now);
  };

  beforeEach(() => {
    throttle = new LoginThrottleService();
  });

  it('laisse passer sous le seuil de 5 échecs', () => {
    fail(MAX_LOGIN_FAILURES - 1);

    expect(() => throttle.assertAllowed(email, 1000)).not.toThrow();
  });

  it('bloque après 5 échecs pendant 15 minutes (429)', () => {
    fail(MAX_LOGIN_FAILURES);

    expect(() => throttle.assertAllowed(email, 1000)).toThrow(HttpException);
    expect(() => throttle.assertAllowed(email, LOGIN_LOCK_MS - 1)).toThrow(
      'Trop de tentatives de connexion, réessayez dans 15 minutes',
    );
  });

  it('débloque une fois les 15 minutes écoulées', () => {
    fail(MAX_LOGIN_FAILURES);

    expect(() => throttle.assertAllowed(email, LOGIN_LOCK_MS)).not.toThrow();
  });

  it('ne bloque que l’email concerné', () => {
    fail(MAX_LOGIN_FAILURES);

    expect(() =>
      throttle.assertAllowed('other@example.com', 1000),
    ).not.toThrow();
  });

  it('remet le compteur à zéro après une connexion réussie', () => {
    fail(MAX_LOGIN_FAILURES - 1);
    throttle.reset(email);
    fail(1);

    expect(() => throttle.assertAllowed(email, 1000)).not.toThrow();
  });
});
