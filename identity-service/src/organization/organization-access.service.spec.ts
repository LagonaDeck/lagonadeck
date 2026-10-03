import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Permission } from '../generated/prisma/client';
import { OrganizationAccessService } from './organization-access.service';

describe('OrganizationAccessService', () => {
  let prisma: { organizationMember: { findUnique: jest.Mock } };
  let access: OrganizationAccessService;

  const memberOf = (
    ...groups: { isOwner?: boolean; permissions?: Permission[] }[]
  ) => ({
    groups: groups.map((group) => ({
      group: { isOwner: false, permissions: [], ...group },
    })),
  });

  beforeEach(() => {
    prisma = { organizationMember: { findUnique: jest.fn() } };
    access = new OrganizationAccessService(prisma as never);
  });

  describe('getPermissions', () => {
    it('donne toutes les permissions au groupe Owner, sans les stocker', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        memberOf({ isOwner: true }),
      );

      await expect(access.getPermissions('user-1', 'org-1')).resolves.toEqual(
        Object.values(Permission),
      );
    });

    it("ne donne aucune permission à un membre d'un groupe sans permission", async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(memberOf({}));

      await expect(access.getPermissions('user-1', 'org-1')).resolves.toEqual(
        [],
      );
    });

    it('cumule les permissions de tous les groupes, sans doublon', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        memberOf(
          { permissions: ['MEMBER_INVITE', 'BILLING_VIEW'] },
          { permissions: ['GROUP_CREATE', 'BILLING_VIEW'] },
        ),
      );

      const permissions = await access.getPermissions('user-1', 'org-1');

      expect(permissions.sort()).toEqual(
        ['BILLING_VIEW', 'GROUP_CREATE', 'MEMBER_INVITE'].sort(),
      );
    });

    it("lève une 404 pour une organisation dont l'utilisateur n'est pas membre", async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        access.getPermissions('user-1', 'org-other'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("cherche l'appartenance sur le couple utilisateur et organisation", async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(memberOf({}));

      await access.getPermissions('user-1', 'org-1');

      expect(prisma.organizationMember.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId_userId: {
              organizationId: 'org-1',
              userId: 'user-1',
            },
          },
        }),
      );
    });
  });

  describe('requirePermission', () => {
    it('laisse passer un membre qui a la permission via un de ses groupes', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        memberOf({}, { permissions: ['GROUP_CREATE'] }),
      );

      await expect(
        access.requirePermission('user-1', 'org-1', 'GROUP_CREATE'),
      ).resolves.toBeUndefined();
    });

    it('laisse passer le Owner pour n’importe quelle permission', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        memberOf({ isOwner: true }),
      );

      await expect(
        access.requirePermission('user-1', 'org-1', 'BILLING_MANAGE'),
      ).resolves.toBeUndefined();
    });

    it('lève une 403 pour un membre sans la permission', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(
        memberOf({ permissions: ['BILLING_VIEW'] }),
      );

      await expect(
        access.requirePermission('user-1', 'org-1', 'BILLING_MANAGE'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lève une 404 et non une 403 pour un non-membre, même Owner ailleurs', async () => {
      prisma.organizationMember.findUnique.mockImplementation(
        ({
          where,
        }: {
          where: { organizationId_userId: { organizationId: string } };
        }) =>
          where.organizationId_userId.organizationId === 'org-1'
            ? memberOf({ isOwner: true })
            : null,
      );

      await expect(
        access.requirePermission('user-1', 'org-2', 'GROUP_CREATE'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
