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
import { WorkspaceRole } from '../../generated/prisma/enums';

const WS = 'ws-1';
const workspace = {
  id: WS,
  name: 'Boutique',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let roles: Record<string, WorkspaceRole>;
  let prisma: {
    $transaction: jest.Mock;
    user: { findUnique: jest.Mock };
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
    // Rôles des membres du workspace WS, indexés par userId.
    roles = {
      owner: WorkspaceRole.OWNER,
      admin: WorkspaceRole.ADMIN,
      member: WorkspaceRole.MEMBER,
      member2: WorkspaceRole.MEMBER,
    };
    prisma = {
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
      user: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve({ id: where.id, email: `${where.id}@example.com` }),
        ),
      },
      workspace: {
        create: jest.fn().mockResolvedValue(workspace),
        update: jest.fn().mockResolvedValue(workspace),
        delete: jest.fn(),
      },
      workspaceMember: {
        findUnique: jest.fn(({ where: { workspaceId_userId: key } }) => {
          const role = key.workspaceId === WS ? roles[key.userId] : undefined;
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
      await expect(service.findOne('stranger', WS)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuse le renommage à un MEMBER', async () => {
      await expect(service.rename('member', WS, 'X')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('refuse la suppression à un ADMIN', async () => {
      await expect(service.remove('admin', WS)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await service.remove('owner', WS);
      expect(prisma.workspace.delete).toHaveBeenCalledWith({
        where: { id: WS },
      });
    });
  });

  describe('removeMember', () => {
    it.each([
      ['member', 'member', 'un membre quitte le workspace'],
      ['admin', 'member', 'un ADMIN retire un MEMBER'],
      ['owner', 'admin', 'le OWNER retire un ADMIN'],
    ])('%s retire %s : %s', async (actor, target) => {
      await service.removeMember(actor, WS, target);
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
        service.removeMember(actor, WS, target),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.workspaceMember.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateMemberRole', () => {
    it("transfère la propriété en rétrogradant d'abord l'ancien OWNER", async () => {
      await service.updateMemberRole('owner', WS, 'admin', WorkspaceRole.OWNER);
      expect(prisma.workspaceMember.update.mock.calls).toEqual([
        [
          {
            where: { workspaceId_userId: { workspaceId: WS, userId: 'owner' } },
            data: { role: WorkspaceRole.ADMIN },
          },
        ],
        [
          {
            where: { workspaceId_userId: { workspaceId: WS, userId: 'admin' } },
            data: { role: WorkspaceRole.OWNER },
          },
        ],
      ]);
    });

    it('est réservé au OWNER, qui ne peut pas cibler son propre rôle', async () => {
      await expect(
        service.updateMemberRole('admin', WS, 'member', WorkspaceRole.ADMIN),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.updateMemberRole('owner', WS, 'owner', WorkspaceRole.MEMBER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('invitations', () => {
    const invitation = (overrides = {}) => ({
      id: 'inv-1',
      workspaceId: WS,
      email: 'newcomer@example.com',
      role: WorkspaceRole.ADMIN,
      expiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    });

    it("refuse d'inviter une adresse déjà membre", async () => {
      prisma.workspaceMember.findFirst.mockResolvedValue({ userId: 'member' });
      await expect(
        service.invite('admin', WS, {
          email: 'member@example.com',
          role: WorkspaceRole.MEMBER,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("accepte une invitation adressée à l'e-mail de l'appelant", async () => {
      prisma.workspaceInvitation.findUnique.mockResolvedValue(invitation());
      const dto = await service.acceptInvitation('newcomer', 'inv-1');
      expect(prisma.workspaceMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            workspaceId: WS,
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
  });
});
