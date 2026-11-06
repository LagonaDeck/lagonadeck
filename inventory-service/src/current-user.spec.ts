import { ForbiddenException } from '@nestjs/common';
import { CATALOG_MANAGE, requireStaff } from './current-user';

describe('requireStaff', () => {
  it('laisse passer un membre de l’équipe qui a la permission', () => {
    expect(() =>
      requireStaff(
        { id: 'staff-1', staffPermissions: [CATALOG_MANAGE] },
        CATALOG_MANAGE,
      ),
    ).not.toThrow();
  });

  it('refuse un utilisateur hors de l’équipe', () => {
    expect(() =>
      requireStaff({ id: 'user-1', staffPermissions: [] }, CATALOG_MANAGE),
    ).toThrow(ForbiddenException);
  });
});
