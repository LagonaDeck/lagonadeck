import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Permission, Prisma } from '../generated/prisma/client';
import { GroupService } from './group.service';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, {
    code,
    clientVersion: '7.10.0',
  });

describe('GroupService', () => {
  let prisma: {
    group: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    groupMember: { create: jest.Mock; deleteMany: jest.Mock };
  };
  let access: { getPermissions: jest.Mock; requirePermission: jest.Mock };
  let service: GroupService;

  const ownerGroup = { isOwner: true, permissions: [] };
  const customGroup = (permissions: Permission[] = []) => ({
    isOwner: false,
    permissions,
  });

  beforeEach(() => {
    prisma = {
      group: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(customGroup()),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn(),
      },
      groupMember: { create: jest.fn(), deleteMany: jest.fn() },
    };
    access = {
      getPermissions: jest.fn(),
      requirePermission: jest.fn(),
    };
    service = new GroupService(prisma as never, access as never);
  });

  it('liste les groupes avec les permissions effectives : toutes pour Owner', async () => {
    prisma.group.findMany.mockResolvedValue([
      {
        id: 'g-owner',
        name: 'Owner',
        isOwner: true,
        permissions: [],
        members: [{ userId: 'user-1' }],
      },
      {
        id: 'g-member',
        name: 'Member',
        isOwner: false,
        permissions: [],
        members: [],
      },
    ]);

    const groups = await service.list('user-1', 'org-1');

    expect(access.getPermissions).toHaveBeenCalledWith('user-1', 'org-1');
    expect(groups).toEqual([
      {
        id: 'g-owner',
        name: 'Owner',
        isOwner: true,
        permissions: Object.values(Permission),
        memberIds: ['user-1'],
      },
      {
        id: 'g-member',
        name: 'Member',
        isOwner: false,
        permissions: [],
        memberIds: [],
      },
    ]);
  });

  describe('création, renommage et suppression', () => {
    it('crée un groupe sans permission avec GROUP_CREATE', async () => {
      prisma.group.create.mockResolvedValue({
        id: 'group-1',
        name: 'Vendeurs',
        isOwner: false,
        permissions: [],
      });

      const group = await service.create('user-1', 'org-1', 'Vendeurs');

      expect(access.requirePermission).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        'GROUP_CREATE',
      );
      expect(prisma.group.create.mock.calls[0][0].data).toEqual({
        organizationId: 'org-1',
        name: 'Vendeurs',
      });
      expect(group).toEqual(
        expect.objectContaining({ permissions: [], memberIds: [] }),
      );
    });

    it('refuse un nom déjà pris dans la même organisation (409)', async () => {
      prisma.group.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.create('user-1', 'org-1', 'Member'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuse la création sans GROUP_CREATE', async () => {
      access.requirePermission.mockRejectedValue(new ForbiddenException());

      await expect(
        service.create('user-1', 'org-1', 'Vendeurs'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.group.create).not.toHaveBeenCalled();
    });

    it('renomme un groupe avec GROUP_UPDATE', async () => {
      await service.rename('user-1', 'org-1', 'group-1', 'Comptables');

      expect(access.requirePermission).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        'GROUP_UPDATE',
      );
      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { name: 'Comptables' },
      });
    });

    it('supprime le groupe Member avec GROUP_DELETE', async () => {
      await service.delete('user-1', 'org-1', 'group-member');

      expect(prisma.group.delete).toHaveBeenCalledWith({
        where: { id: 'group-member' },
      });
    });

    it('refuse de supprimer ou de renommer le groupe Owner', async () => {
      prisma.group.findFirst.mockResolvedValue(ownerGroup);

      await expect(
        service.delete('user-1', 'org-1', 'group-owner'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.rename('user-1', 'org-1', 'group-owner', 'Admins'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.group.delete).not.toHaveBeenCalled();
      expect(prisma.group.update).not.toHaveBeenCalled();
    });

    it("cherche le groupe dans l'organisation de l'URL : celui d'une autre organisation donne 404", async () => {
      prisma.group.findFirst.mockResolvedValue(null);

      await expect(
        service.delete('user-1', 'org-1', 'group-of-org-2'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.group.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'group-of-org-2', organizationId: 'org-1' },
        }),
      );
      expect(prisma.group.delete).not.toHaveBeenCalled();
    });
  });

  describe('setPermissions', () => {
    it('exige GROUP_MANAGE_PERMISSIONS', async () => {
      access.getPermissions.mockResolvedValue(['GROUP_CREATE']);

      await expect(
        service.setPermissions('user-1', 'org-1', 'group-1', []),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("accorde des permissions que l'utilisateur possède et en retire d'autres", async () => {
      access.getPermissions.mockResolvedValue([
        'GROUP_MANAGE_PERMISSIONS',
        'MEMBER_INVITE',
      ]);
      prisma.group.findFirst.mockResolvedValue(customGroup(['BILLING_MANAGE']));

      await service.setPermissions('user-1', 'org-1', 'group-1', [
        'MEMBER_INVITE',
      ]);

      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { permissions: ['MEMBER_INVITE'] },
      });
    });

    it("refuse d'accorder une permission que l'utilisateur ne possède pas", async () => {
      access.getPermissions.mockResolvedValue(['GROUP_MANAGE_PERMISSIONS']);

      await expect(
        service.setPermissions('user-1', 'org-1', 'group-1', [
          'BILLING_MANAGE',
        ]),
      ).rejects.toThrow(
        'Vous ne pouvez accorder que des permissions que vous possédez',
      );
      expect(prisma.group.update).not.toHaveBeenCalled();
    });

    it('conserve une permission déjà présente que l’utilisateur ne possède pas', async () => {
      access.getPermissions.mockResolvedValue(['GROUP_MANAGE_PERMISSIONS']);
      prisma.group.findFirst.mockResolvedValue(customGroup(['BILLING_MANAGE']));

      await service.setPermissions('user-1', 'org-1', 'group-1', [
        'BILLING_MANAGE',
      ]);

      expect(prisma.group.update).toHaveBeenCalled();
    });

    it('refuse de modifier les permissions du groupe Owner', async () => {
      access.getPermissions.mockResolvedValue(Object.values(Permission));
      prisma.group.findFirst.mockResolvedValue(ownerGroup);

      await expect(
        service.setPermissions('user-1', 'org-1', 'group-owner', []),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('membres des groupes', () => {
    it('ajoute un membre de l’organisation à un groupe avec MEMBER_MANAGE_GROUPS', async () => {
      await service.addMember('user-1', 'org-1', 'group-1', 'user-2');

      expect(access.requirePermission).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        'MEMBER_MANAGE_GROUPS',
      );
      expect(prisma.groupMember.create).toHaveBeenCalledWith({
        data: { groupId: 'group-1', organizationId: 'org-1', userId: 'user-2' },
      });
    });

    it("refuse d'ajouter quelqu'un qui n'est pas membre de l'organisation (404)", async () => {
      prisma.groupMember.create.mockRejectedValue(prismaError('P2003'));

      await expect(
        service.addMember('user-1', 'org-1', 'group-1', 'user-of-org-2'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("ignore l'ajout d'un membre déjà présent dans le groupe", async () => {
      prisma.groupMember.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.addMember('user-1', 'org-1', 'group-1', 'user-2'),
      ).resolves.toBeUndefined();
    });

    it("refuse d'ajouter ou de retirer un membre du groupe Owner : un seul propriétaire", async () => {
      prisma.group.findFirst.mockResolvedValue(ownerGroup);

      await expect(
        service.addMember('user-1', 'org-1', 'group-owner', 'user-2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.removeMember('user-1', 'org-1', 'group-owner', 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.groupMember.create).not.toHaveBeenCalled();
      expect(prisma.groupMember.deleteMany).not.toHaveBeenCalled();
    });

    it("retire un membre d'un groupe", async () => {
      await service.removeMember('user-1', 'org-1', 'group-1', 'user-2');

      expect(prisma.groupMember.deleteMany).toHaveBeenCalledWith({
        where: { groupId: 'group-1', userId: 'user-2' },
      });
    });
  });
});
