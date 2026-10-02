import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { WorkspaceRole } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';

const WORKSPACE_ID = 'ws-1';
const uniqueConstraintError = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: 'test',
  });
const workspace = {
  id: WORKSPACE_ID,
  name: 'Boutique',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let roles: Record<string, WorkspaceRole>;
  let prisma: {
    $transaction: jest.Mock;
    workspace: { create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    workspaceMember: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    workspaceInvitation: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    // Rôles des membres du workspace WORKSPACE_ID, indexés par userId.
    roles = {
      owner: WorkspaceRole.OWNER,
      admin: WorkspaceRole.ADMIN,
      member: WorkspaceRole.MEMBER,
      member2: WorkspaceRole.MEMBER,
    };
    prisma = {
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
      workspace: {
        create: jest.fn().mockResolvedValue(workspace),
        update: jest.fn().mockResolvedValue(workspace),
        delete: jest.fn(),
      },
      workspaceMember: {
        findUnique: jest.fn(({ where: { workspaceId_userId: key } }) => {
          const role =
            key.workspaceId === WORKSPACE_ID ? roles[key.userId] : undefined;
          return Promise.resolve(
            role ? { ...key, role, workspace, createdAt: new Date() } : null,
          );
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        create: jest.fn(({ data }) => Promise.resolve({ ...data, workspace })),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workspaceInvitation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: UserService,
          useValue: {
            findById: (id: string) =>
              Promise.resolve({ id, email: `${id}@example.com` }),
          },
        },
      ],
    }).compile();
    service = module.get(WorkspacesService);
  });

  it("crée le workspace avec l'appelant comme OWNER", async () => {
    const dto = await service.create('owner', 'Boutique');
    expect(prisma.workspace.create).toHaveBeenCalledWith({
      data: {
        name: 'Boutique',
        members: { create: { userId: 'owner', role: WorkspaceRole.OWNER } },
      },
    });
    expect(dto.role).toBe(WorkspaceRole.OWNER);
  });

  describe('contrôle des rôles', () => {
    it("renvoie 404 à un non-membre, sans révéler l'existence du workspace", async () => {
      await expect(
        service.findOne('stranger', WORKSPACE_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse le renommage à un MEMBER', async () => {
      await expect(
        service.rename('member', WORKSPACE_ID, 'X'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuse la suppression à un ADMIN', async () => {
      await expect(
        service.remove('admin', WORKSPACE_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await service.remove('owner', WORKSPACE_ID);
      expect(prisma.workspace.delete).toHaveBeenCalledWith({
        where: { id: WORKSPACE_ID },
      });
    });
  });

  describe('removeMember', () => {
    it.each([
      ['member', 'member', 'un membre quitte le workspace'],
      ['admin', 'member', 'un ADMIN retire un MEMBER'],
      ['owner', 'admin', 'le OWNER retire un ADMIN'],
    ])('%s retire %s : %s', async (actor, target) => {
      await service.removeMember(actor, WORKSPACE_ID, target);
      expect(prisma.workspaceMember.delete).toHaveBeenCalled();
    });

    it.each([
      ['member', 'member2'],
      ['admin', 'admin2'],
      ['member', 'admin'],
      ['owner', 'owner'],
      ['admin', 'owner'],
    ])('%s ne peut pas retirer %s', async (actor, target) => {
      roles.admin2 = WorkspaceRole.ADMIN;
      await expect(
        service.removeMember(actor, WORKSPACE_ID, target),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.workspaceMember.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateMemberRole', () => {
    it("transfère la propriété en rétrogradant d'abord l'ancien OWNER et supprime ses invitations", async () => {
      await service.updateMemberRole(
        'owner',
        WORKSPACE_ID,
        'admin',
        WorkspaceRole.OWNER,
      );
      expect(prisma.workspaceMember.update.mock.calls).toEqual([
        [
          {
            where: {
              workspaceId_userId: {
                workspaceId: WORKSPACE_ID,
                userId: 'owner',
              },
            },
            data: { role: WorkspaceRole.ADMIN },
          },
        ],
        [
          {
            where: {
              workspaceId_userId: {
                workspaceId: WORKSPACE_ID,
                userId: 'admin',
              },
            },
            data: { role: WorkspaceRole.OWNER },
          },
        ],
      ]);
      expect(prisma.workspaceInvitation.deleteMany).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID, invitedById: 'owner' },
      });
    });

    it('renvoie 409 quand deux transferts de propriété se croisent', async () => {
      prisma.$transaction.mockRejectedValue(uniqueConstraintError());
      await expect(
        service.updateMemberRole(
          'owner',
          WORKSPACE_ID,
          'admin',
          WorkspaceRole.OWNER,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("change le rôle d'un membre sans toucher au OWNER", async () => {
      await service.updateMemberRole(
        'owner',
        WORKSPACE_ID,
        'member',
        WorkspaceRole.ADMIN,
      );
      expect(prisma.workspaceMember.update.mock.calls).toEqual([
        [
          {
            where: {
              workspaceId_userId: {
                workspaceId: WORKSPACE_ID,
                userId: 'member',
              },
            },
            data: { role: WorkspaceRole.ADMIN },
          },
        ],
      ]);
    });

    it("renvoie 404 quand la cible n'est pas membre", async () => {
      await expect(
        service.updateMemberRole(
          'owner',
          WORKSPACE_ID,
          'stranger',
          WorkspaceRole.ADMIN,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('est réservé au OWNER, qui ne peut pas cibler son propre rôle', async () => {
      await expect(
        service.updateMemberRole(
          'admin',
          WORKSPACE_ID,
          'member',
          WorkspaceRole.ADMIN,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.updateMemberRole(
          'owner',
          WORKSPACE_ID,
          'owner',
          WorkspaceRole.MEMBER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('invitations', () => {
    const invitation = (overrides = {}) => ({
      id: 'inv-1',
      workspaceId: WORKSPACE_ID,
      email: 'newcomer@example.com',
      role: WorkspaceRole.ADMIN,
      invitedById: 'owner',
      expiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    });

    it("refuse d'inviter une adresse déjà membre", async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({ userId: 'member' });
      await expect(
        service.invite('admin', WORKSPACE_ID, {
          email: 'member@example.com',
          role: WorkspaceRole.MEMBER,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('réserve au OWNER les invitations ADMIN', async () => {
      prisma.workspaceInvitation.upsert.mockResolvedValue({
        ...invitation(),
        workspace,
      });
      const dto = { email: 'newcomer@example.com', role: WorkspaceRole.ADMIN };

      await expect(
        service.invite('admin', WORKSPACE_ID, dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.invite('owner', WORKSPACE_ID, dto),
      ).resolves.toMatchObject({
        role: WorkspaceRole.ADMIN,
      });
    });

    it("ré-inviter met à jour le rôle, l'auteur et repousse l'expiration", async () => {
      prisma.workspaceInvitation.upsert.mockResolvedValue({
        ...invitation(),
        workspace,
      });
      await service.invite('admin', WORKSPACE_ID, {
        email: 'newcomer@example.com',
        role: WorkspaceRole.MEMBER,
      });
      expect(prisma.workspaceInvitation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            role: WorkspaceRole.MEMBER,
            invitedById: 'admin',
            expiresAt: expect.any(Date),
          },
        }),
      );
    });

    it("liste côté admin les seules invitations que l'invité peut encore accepter", async () => {
      prisma.workspaceInvitation.findMany.mockResolvedValue([]);
      await service.listInvitations('admin', WORKSPACE_ID);
      expect(prisma.workspaceInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId: WORKSPACE_ID,
            expiresAt: { gt: expect.any(Date) },
          },
        }),
      );
    });

    it('liste côté invité les invitations non expirées adressées à son e-mail', async () => {
      prisma.workspaceInvitation.findMany.mockResolvedValue([]);
      await service.findMyInvitations('newcomer');
      expect(prisma.workspaceInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            email: 'newcomer@example.com',
            expiresAt: { gt: expect.any(Date) },
          },
        }),
      );
    });

    it("renvoie 404 à la révocation d'une invitation d'un autre workspace", async () => {
      prisma.workspaceInvitation.deleteMany.mockResolvedValue({ count: 0 });
      await expect(
        service.revokeInvitation('admin', WORKSPACE_ID, 'inv-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.workspaceInvitation.deleteMany).toHaveBeenCalledWith({
        where: { id: 'inv-1', workspaceId: WORKSPACE_ID },
      });
    });

    it("refuse seulement une invitation adressée à l'e-mail de l'appelant", async () => {
      prisma.workspaceInvitation.deleteMany.mockResolvedValueOnce({ count: 1 });
      await service.declineInvitation('newcomer', 'inv-1');
      expect(prisma.workspaceInvitation.deleteMany).toHaveBeenCalledWith({
        where: { id: 'inv-1', email: 'newcomer@example.com' },
      });

      prisma.workspaceInvitation.deleteMany.mockResolvedValueOnce({ count: 0 });
      await expect(
        service.declineInvitation('someone-else', 'inv-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("accepte une invitation adressée à l'e-mail de l'appelant", async () => {
      prisma.workspaceInvitation.findUnique.mockResolvedValue(invitation());
      const dto = await service.acceptInvitation('newcomer', 'inv-1');
      expect(prisma.workspaceMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            workspaceId: WORKSPACE_ID,
            userId: 'newcomer',
            role: WorkspaceRole.ADMIN,
          },
        }),
      );
      expect(prisma.workspaceInvitation.delete).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
      });
      expect(dto.role).toBe(WorkspaceRole.ADMIN);
    });

    it("renvoie 404 pour l'invitation d'un autre utilisateur", async () => {
      prisma.workspaceInvitation.findUnique.mockResolvedValue(invitation());
      await expect(
        service.acceptInvitation('someone-else', 'inv-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse une invitation expirée', async () => {
      prisma.workspaceInvitation.findUnique.mockResolvedValue(
        invitation({ expiresAt: new Date(Date.now() - 1) }),
      );
      await expect(
        service.acceptInvitation('newcomer', 'inv-1'),
      ).rejects.toBeInstanceOf(GoneException);
    });

    it("renvoie 409 quand l'invité est déjà membre", async () => {
      prisma.workspaceInvitation.findUnique.mockResolvedValue(invitation());
      prisma.$transaction.mockRejectedValue(uniqueConstraintError());
      await expect(
        service.acceptInvitation('newcomer', 'inv-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it.each([
      ['admin', "l'auteur d'une invitation ADMIN n'est plus OWNER"],
      ['stranger', "l'auteur a quitté le workspace"],
    ])("refuse l'invitation quand %s : %s", async (invitedById) => {
      prisma.workspaceInvitation.findUnique.mockResolvedValue(
        invitation({ invitedById }),
      );
      await expect(
        service.acceptInvitation('newcomer', 'inv-1'),
      ).rejects.toBeInstanceOf(GoneException);
      expect(prisma.workspaceMember.create).not.toHaveBeenCalled();
    });
  });
});
