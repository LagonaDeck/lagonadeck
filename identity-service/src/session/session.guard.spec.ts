import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionGuard } from './session.guard';

const contextOf = (request: { headers: Record<string, string> }) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as ExecutionContext;

describe('SessionGuard', () => {
  const guard = new SessionGuard();

  it("retient l'utilisateur transmis par la gateway", () => {
    const request = { headers: { 'x-user-id': 'user-1' } };

    expect(guard.canActivate(contextOf(request))).toBe(true);
    expect(request).toHaveProperty('userId', 'user-1');
  });

  it('refuse une requête sans utilisateur', () => {
    expect(() => guard.canActivate(contextOf({ headers: {} }))).toThrow(
      new UnauthorizedException('Session invalide'),
    );
  });
});
