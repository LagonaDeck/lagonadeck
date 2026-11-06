import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalGuard } from './internal.guard';

const withHeaders = (headers: Record<string, string>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as ExecutionContext;

describe('InternalGuard', () => {
  const guard = new InternalGuard();

  beforeEach(() => {
    process.env.INTERNAL_TOKEN = 'secret';
  });

  it('accepte un appel qui porte le secret interne', () => {
    expect(
      guard.canActivate(withHeaders({ 'x-internal-token': 'secret' })),
    ).toBe(true);
  });

  it.each([
    ['sans secret', {}],
    ['avec un autre secret', { 'x-internal-token': 'autre' }],
  ])('refuse un appel %s', (_, headers) => {
    expect(() => guard.canActivate(withHeaders(headers))).toThrow(
      UnauthorizedException,
    );
  });
});
