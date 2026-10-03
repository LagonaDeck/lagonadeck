import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { OrganizationService } from './organization.service';

describe('OrganizationService', () => {
  let prisma: {
    $transaction: jest.Mock;
    organization: { findMany: jest.Mock; update: jest.Mock; delete: jest.Mock };
    organizationMember: { findUnique: jest.Mock; delete: jest.Mock };
  };
  let access: {
    getPermissions: jest.Mock;
    requirePermission: jest.Mock;
    requireOwner: jest.Mock;
  };
  let service: OrganizationService;
  let tx: {
    $queryRaw: jest.Mock;
    organization: { create: jest.Mock };
    organizationMember: { count: jest.Mock };
    groupMember: { create: jest.Mock; findFirst: jest.Mock; delete: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((write: (tx: unknown) => unknown) => write(tx)),
      organization: {
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      organizationMember: { findUnique: jest.fn(), delete: jest.fn() },
    };
    access = {
      getPermissions: jest.fn(),
      requirePermission: jest.fn(),
      requireOwner: jest.fn(),
    };
    service = new OrganizationService(prisma as never, access as never);
    tx = {
      $queryRaw: jest.fn(),
      organizationMember: { count: jest.fn().mockResolvedValue(1) },
      organization: {
        create: jest.fn().mockResolvedValue({
          id: 'org-1',
          groups: [
            { id: 'group-owner', isOwner: true },
            { id: 'group-member', isOwner: false },
          ],
        }),
      },
      groupMember: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue({ groupId: 'group-owner' }),
        delete: jest.fn(),
      },
    };
  });

  const createPersonal = () =>
    service.createPersonal(tx as never, { id: 'user-1', username: 'JaneDoe' });

  it("crée l'organisation personnelle de l'utilisateur, dont il est membre", async () => {
    await createPersonal();

    const { data } = tx.organization.create.mock.calls[0][0];
    expect(data.name).toBe('Organisation de JaneDoe');
    expect(data.members).toEqual({ create: { userId: 'user-1' } });
  });

  it('crée les groupes Owner et Member, Member sans aucune permission', async () => {
    await createPersonal();

    const { data } = tx.organization.create.mock.calls[0][0];
    expect(data.groups.create).toEqual([
      { name: 'Owner', isOwner: true },
      { name: 'Member' },
    ]);
  });

  it('place le créateur dans le groupe Owner', async () => {
    await createPersonal();

    expect(tx.groupMember.create).toHaveBeenCalledWith({
      data: {
        groupId: 'group-owner',
        organizationId: 'org-1',
        userId: 'user-1',
      },
    });
  });

  it("liste les organisations de l'utilisateur avec les noms de ses groupes", async () => {
    prisma.organization.findMany.mockResolvedValue([
      {
        id: 'org-1',
        name: 'Organisation de Jane',
        plan: 'DISCOVERY',
        members: [{ groups: [{ group: { name: 'Owner' } }] }],
      },
    ]);

    const organizations = await service.listForUser('user-1');

    const query = prisma.organization.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ members: { some: { userId: 'user-1' } } });
    expect(query.select.members.where).toEqual({ userId: 'user-1' });
    expect(organizations).toEqual([
      {
        id: 'org-1',
        name: 'Organisation de Jane',
        plan: 'DISCOVERY',
        groups: ['Owner'],
      },
    ]);
  });

  it('exige ORGANIZATION_MANAGE pour renommer, avant toute écriture', async () => {
    access.requirePermission.mockRejectedValue(new ForbiddenException());

    await expect(
      service.rename('user-1', 'org-1', 'Nouveau nom'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.requirePermission).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      'ORGANIZATION_MANAGE',
    );
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  describe('removeMember', () => {
    it("retire un membre qui n'est pas le propriétaire", async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        groups: [{ group: { isOwner: false } }],
      });

      await service.removeMember('user-1', 'org-1', 'user-2');

      expect(access.requirePermission).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        'MEMBER_REMOVE',
      );
      expect(prisma.organizationMember.delete).toHaveBeenCalledWith({
        where: {
          organizationId_userId: { organizationId: 'org-1', userId: 'user-2' },
        },
      });
    });

    it("refuse de retirer le propriétaire : l'organisation garde son seul Owner", async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        groups: [{ group: { isOwner: true } }],
      });

      await expect(
        service.removeMember('user-2', 'org-1', 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
    });

    it("lève une 404 pour quelqu'un qui n'est pas membre de cette organisation", async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.removeMember('user-1', 'org-1', 'user-of-another-org'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it("crée une organisation dont l'utilisateur est le propriétaire", async () => {
    tx.organization.create.mockResolvedValue({
      id: 'org-2',
      plan: 'DISCOVERY',
      groups: [{ id: 'group-owner-2', isOwner: true }],
    });

    const organization = await service.create('user-1', 'Boutique de Lausanne');

    const { data } = tx.organization.create.mock.calls[0][0];
    expect(data.name).toBe('Boutique de Lausanne');
    expect(data.members).toEqual({ create: { userId: 'user-1' } });
    expect(tx.groupMember.create).toHaveBeenCalledWith({
      data: {
        groupId: 'group-owner-2',
        organizationId: 'org-2',
        userId: 'user-1',
      },
    });
    expect(organization).toEqual({
      id: 'org-2',
      name: 'Boutique de Lausanne',
      plan: 'DISCOVERY',
      groups: ['Owner'],
    });
  });

  it("refuse de créer une 4e organisation pour l'utilisateur (409)", async () => {
    tx.organizationMember.count.mockResolvedValue(3);

    await expect(service.create('user-1', 'Quatrième')).rejects.toThrow(
      'Vous faites déjà partie de 3 organisations, le maximum',
    );
    expect(tx.organization.create).not.toHaveBeenCalled();
  });

  describe('quitter une organisation', () => {
    it('ne demande pas MEMBER_REMOVE pour se retirer soi-même', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        groups: [{ group: { isOwner: false } }],
      });

      await service.removeMember('user-2', 'org-1', 'user-2');

      expect(access.requirePermission).not.toHaveBeenCalled();
      expect(access.getPermissions).toHaveBeenCalledWith('user-2', 'org-1');
      expect(prisma.organizationMember.delete).toHaveBeenCalled();
    });

    it('refuse au propriétaire de quitter son organisation', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        groups: [{ group: { isOwner: true } }],
      });

      await expect(
        service.removeMember('user-1', 'org-1', 'user-1'),
      ).rejects.toThrow("Le propriétaire ne peut pas quitter l'organisation");
      expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it("supprime l'organisation quand le propriétaire le demande", async () => {
      await service.delete('user-1', 'org-1');

      expect(access.requireOwner).toHaveBeenCalledWith('user-1', 'org-1');
      expect(prisma.organization.delete).toHaveBeenCalledWith({
        where: { id: 'org-1' },
      });
    });

    it('ne supprime rien si ce n’est pas le propriétaire', async () => {
      access.requireOwner.mockRejectedValue(new ForbiddenException());

      await expect(service.delete('user-2', 'org-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.organization.delete).not.toHaveBeenCalled();
    });
  });

  describe('transferOwnership', () => {
    it('passe la place du groupe Owner au nouveau propriétaire', async () => {
      await service.transferOwnership('user-1', 'org-1', 'user-2');

      expect(tx.groupMember.delete).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId: 'group-owner', userId: 'user-1' } },
      });
      expect(tx.groupMember.create).toHaveBeenCalledWith({
        data: {
          groupId: 'group-owner',
          organizationId: 'org-1',
          userId: 'user-2',
        },
      });
    });

    it('refuse un membre qui n’est pas propriétaire (403)', async () => {
      tx.groupMember.findFirst.mockResolvedValue(null);

      await expect(
        service.transferOwnership('user-3', 'org-1', 'user-2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.groupMember.delete).not.toHaveBeenCalled();
    });

    it("refuse un destinataire qui n'est pas membre de l'organisation (404)", async () => {
      tx.groupMember.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('P2003', {
          code: 'P2003',
          clientVersion: '7.10.0',
        }),
      );

      await expect(
        service.transferOwnership('user-1', 'org-1', 'stranger'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse un transfert à soi-même (400)', async () => {
      await expect(
        service.transferOwnership('user-1', 'org-1', 'user-1'),
      ).rejects.toThrow('Vous êtes déjà le propriétaire');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
