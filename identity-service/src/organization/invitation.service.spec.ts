import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { InvitationService } from './invitation.service';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, {
    code,
    clientVersion: '7.10.0',
  });

describe('InvitationService', () => {
  let prisma: {
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    user: { findMany: jest.Mock; findUnique: jest.Mock };
    emailInvitation: {
      create: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    organizationMember: {
      findUnique: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
    };
    invitation: {
      create: jest.Mock;
      createMany: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let access: { getPermissions: jest.Mock; requirePermission: jest.Mock };
  let service: InvitationService;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      $transaction: jest.fn((write: (tx: unknown) => unknown) => write(prisma)),
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      emailInvitation: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      organizationMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      invitation: {
        create: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    access = { getPermissions: jest.fn(), requirePermission: jest.fn() };
    service = new InvitationService(prisma as never, access as never);
  });

  describe('searchInvitable', () => {
    it('exige MEMBER_INVITE pour chercher des comptes', async () => {
      access.requirePermission.mockRejectedValue(new ForbiddenException());

      await expect(
        service.searchInvitable('user-1', 'org-1', 'misty'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(access.requirePermission).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        'MEMBER_INVITE',
      );
    });

    it("cherche un email exact, en excluant les membres de l'organisation", async () => {
      await service.searchInvitable('user-1', 'org-1', ' Misty@Example.com ');

      const { where, take } = prisma.user.findMany.mock.calls[0][0];
      expect(where).toEqual({
        email: 'misty@example.com',
        memberships: { none: { organizationId: 'org-1' } },
      });
      expect(take).toBe(5);
    });

    it("cherche le début du nom d'utilisateur, sans tenir compte de la casse", async () => {
      await service.searchInvitable('user-1', 'org-1', 'MiS');

      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({
        usernameNormalized: { startsWith: 'mis' },
        memberships: { none: { organizationId: 'org-1' } },
      });
    });

    it('ne cherche rien en dessous de 3 caractères', async () => {
      await expect(
        service.searchInvitable('user-1', 'org-1', 'mi'),
      ).resolves.toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("masque l'email d'un compte trouvé par son nom et signale les invitations en attente", async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-2',
          username: 'Misty',
          email: 'misty@example.com',
          invitationsReceived: [{}],
        },
      ]);

      await expect(
        service.searchInvitable('user-1', 'org-1', 'misty'),
      ).resolves.toEqual([
        {
          id: 'user-2',
          username: 'Misty',
          email: 'm•••@example.com',
          invited: true,
        },
      ]);
    });

    it("renvoie l'email complet quand il a été saisi en entier", async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-2',
          username: 'Misty',
          email: 'misty@example.com',
          invitationsReceived: [],
        },
      ]);

      const [user] = await service.searchInvitable(
        'user-1',
        'org-1',
        'misty@example.com',
      );

      expect(user.email).toBe('misty@example.com');
    });
  });

  describe('invite', () => {
    it("crée l'invitation au nom de l'invitant", async () => {
      await service.invite('user-1', 'org-1', 'user-2');

      expect(prisma.invitation.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          userId: 'user-2',
          invitedById: 'user-1',
        },
      });
    });

    it('refuse un membre existant (409)', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({});

      await expect(
        service.invite('user-1', 'org-1', 'user-2'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.invitation.create).not.toHaveBeenCalled();
    });

    it('refuse une seconde invitation en attente (409)', async () => {
      prisma.invitation.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.invite('user-1', 'org-1', 'user-2'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuse un utilisateur inexistant (404)', async () => {
      prisma.invitation.create.mockRejectedValue(prismaError('P2003'));

      await expect(
        service.invite('user-1', 'org-1', 'unknown'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('accept', () => {
    it("rend l'invité membre, sans groupe, et supprime l'invitation", async () => {
      prisma.invitation.delete.mockResolvedValue({
        organization: { id: 'org-1', name: 'Boutique', plan: 'DISCOVERY' },
      });

      const organization = await service.accept('user-2', 'org-1');

      expect(prisma.invitation.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId_userId: {
              organizationId: 'org-1',
              userId: 'user-2',
            },
          },
        }),
      );
      expect(prisma.organizationMember.create).toHaveBeenCalledWith({
        data: { organizationId: 'org-1', userId: 'user-2' },
      });
      expect(organization).toEqual({
        id: 'org-1',
        name: 'Boutique',
        plan: 'DISCOVERY',
        groups: [],
      });
    });

    it("refuse au-delà de 3 organisations, sans toucher à l'invitation (409)", async () => {
      prisma.organizationMember.count.mockResolvedValue(3);

      await expect(service.accept('user-2', 'org-1')).rejects.toThrow(
        'Vous faites déjà partie de 3 organisations, le maximum',
      );
      expect(prisma.invitation.delete).not.toHaveBeenCalled();
      expect(prisma.organizationMember.create).not.toHaveBeenCalled();
    });

    it('refuse sans invitation : on ne rejoint pas une organisation de soi-même (404)', async () => {
      prisma.invitation.delete.mockRejectedValue(prismaError('P2025'));

      await expect(service.accept('user-2', 'org-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.organizationMember.create).not.toHaveBeenCalled();
    });
  });

  it("refuser supprime seulement l'invitation de l'utilisateur", async () => {
    await service.decline('user-2', 'org-1');

    expect(prisma.invitation.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: 'user-2' },
    });
  });

  it('révoquer exige MEMBER_INVITE', async () => {
    access.requirePermission.mockRejectedValue(new ForbiddenException());

    await expect(
      service.revoke('user-1', 'org-1', 'user-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.invitation.deleteMany).not.toHaveBeenCalled();
  });

  describe('inviteEmail', () => {
    it("enregistre l'invitation d'une adresse sans compte", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.inviteEmail('user-1', 'org-1', 'newcomer@example.com');

      expect(access.requirePermission).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        'MEMBER_INVITE',
      );
      expect(prisma.emailInvitation.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          email: 'newcomer@example.com',
          invitedById: 'user-1',
        },
      });
    });

    it("invite directement le compte si l'adresse en a déjà un", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });

      await service.inviteEmail('user-1', 'org-1', 'misty@example.com');

      expect(prisma.invitation.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          userId: 'user-2',
          invitedById: 'user-1',
        },
      });
      expect(prisma.emailInvitation.create).not.toHaveBeenCalled();
    });

    it('refuse une seconde invitation de la même adresse (409)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.emailInvitation.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.inviteEmail('user-1', 'org-1', 'newcomer@example.com'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('claimEmailInvitations', () => {
    it("transforme les invitations de l'adresse en invitations en attente du compte", async () => {
      prisma.emailInvitation.findMany.mockResolvedValue([
        { organizationId: 'org-1', invitedById: 'user-1' },
        { organizationId: 'org-2', invitedById: 'user-3' },
      ]);

      await service.claimEmailInvitations(prisma as never, {
        id: 'user-9',
        email: 'newcomer@example.com',
      });

      expect(prisma.invitation.createMany).toHaveBeenCalledWith({
        data: [
          { organizationId: 'org-1', userId: 'user-9', invitedById: 'user-1' },
          { organizationId: 'org-2', userId: 'user-9', invitedById: 'user-3' },
        ],
      });
      expect(prisma.emailInvitation.deleteMany).toHaveBeenCalledWith({
        where: { email: 'newcomer@example.com' },
      });
      expect(prisma.organizationMember.create).not.toHaveBeenCalled();
    });

    it("ne fait rien sans invitation pour l'adresse", async () => {
      await service.claimEmailInvitations(prisma as never, {
        id: 'user-9',
        email: 'alone@example.com',
      });

      expect(prisma.invitation.createMany).not.toHaveBeenCalled();
    });
  });
});
