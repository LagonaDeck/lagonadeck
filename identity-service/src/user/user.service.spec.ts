import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { scryptSync } from 'node:crypto';
import { UserService } from './user.service';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { InvitationService } from '../organization/invitation.service';
import { OrganizationService } from '../organization/organization.service';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`Prisma error ${code}`, {
    code,
    clientVersion: '7.10.0',
  });
}

const uniqueConstraintError = () => prismaError('P2002');

describe('UserService', () => {
  let service: UserService;
  let prisma: {
    $transaction: jest.Mock;
    user: {
      create: jest.Mock;
      update: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    session: { deleteMany: jest.Mock };
  };
  let organizationService: { createPersonal: jest.Mock };
  let invitationService: {
    claimEmailInvitations: jest.Mock;
    acceptIn: jest.Mock;
  };

  const baseUser = {
    id: 'user-1',
    email: 'jane@example.com',
    username: 'JaneDoe',
    usernameNormalized: 'janedoe',
    passwordHash: 'hashed',
    salt: 'salt',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((write: unknown) =>
        typeof write === 'function'
          ? write(prisma)
          : Promise.all(write as unknown[]),
      ),
      user: {
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      session: { deleteMany: jest.fn() },
    };
    organizationService = { createPersonal: jest.fn() };
    invitationService = {
      claimEmailInvitations: jest.fn(),
      acceptIn: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaClient, useValue: prisma },
        { provide: OrganizationService, useValue: organizationService },
        { provide: InvitationService, useValue: invitationService },
      ],
    }).compile();

    service = module.get(UserService);
  });

  describe('create', () => {
    const dto = {
      email: 'jane@example.com',
      username: 'JaneDoe',
      password: 'Sup3rSecret!',
    };

    it("hache le mot de passe (scrypt + salt aléatoire) et crée l'utilisateur", async () => {
      prisma.user.create.mockResolvedValue(baseUser);

      const result = await service.create(dto);

      const { data } = prisma.user.create.mock.calls[0][0];
      expect(data).toMatchObject({
        email: dto.email,
        username: 'JaneDoe',
        usernameNormalized: 'janedoe',
      });
      expect(data.passwordHash).not.toContain(dto.password);
      expect(data.passwordHash).toBe(
        scryptSync(dto.password, data.salt, 64).toString('hex'),
      );
      expect(result).toEqual(baseUser);
    });

    it("crée l'organisation personnelle dans la même transaction que le compte", async () => {
      prisma.user.create.mockResolvedValue(baseUser);

      await service.create(dto);

      expect(organizationService.createPersonal).toHaveBeenCalledWith(
        prisma,
        baseUser,
      );
    });

    it('transforme les invitations faites à son email en invitations en attente', async () => {
      prisma.user.create.mockResolvedValue(baseUser);

      await service.create(dto);

      expect(invitationService.claimEmailInvitations).toHaveBeenCalledWith(
        prisma,
        baseUser,
      );
      expect(invitationService.acceptIn).not.toHaveBeenCalled();
    });

    it("rejoint l'organisation dont il accepte l'invitation, sans organisation personnelle", async () => {
      prisma.user.create.mockResolvedValue(baseUser);

      await service.create({ ...dto, invitationOrganizationId: 'org-1' });

      expect(invitationService.acceptIn).toHaveBeenCalledWith(
        prisma,
        baseUser.id,
        'org-1',
      );
      expect(organizationService.createPersonal).not.toHaveBeenCalled();
    });

    it("n'aboutit pas si l'organisation ne peut pas être créée", async () => {
      prisma.user.create.mockResolvedValue(baseUser);
      const dbError = new Error('connexion perdue');
      organizationService.createPersonal.mockRejectedValue(dbError);

      await expect(service.create(dto)).rejects.toBe(dbError);
    });

    it('génère un salt différent à chaque création', async () => {
      prisma.user.create.mockResolvedValue(baseUser);

      await service.create(dto);
      await service.create(dto);

      const [first, second] = prisma.user.create.mock.calls.map(
        ([arg]) => arg.data,
      );
      expect(first.salt).not.toBe(second.salt);
      expect(first.passwordHash).not.toBe(second.passwordHash);
    });

    it('convertit une violation de contrainte unique (P2002) en 409', async () => {
      prisma.user.create.mockRejectedValue(uniqueConstraintError());

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('propage les autres erreurs sans les convertir', async () => {
      const dbError = new Error('connexion perdue');
      prisma.user.create.mockRejectedValue(dbError);

      await expect(service.create(dto)).rejects.toBe(dbError);
    });
  });

  describe('updateProfile', () => {
    it("modifie l'utilisateur connecté et recalcule la clé d'unicité du nom", async () => {
      prisma.user.update.mockResolvedValue(baseUser);

      await service.updateProfile('user-1', { username: 'Janet42' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { username: 'Janet42', usernameNormalized: 'janet42' },
      });
    });

    it("ne touche pas au nom quand seul l'email change", async () => {
      prisma.user.update.mockResolvedValue(baseUser);

      await service.updateProfile('user-1', { email: 'janet@example.com' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { email: 'janet@example.com' },
      });
    });

    it('convertit une violation de contrainte unique (P2002) en 409', async () => {
      prisma.user.update.mockRejectedValue(uniqueConstraintError());

      await expect(
        service.updateProfile('user-1', { email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        ...baseUser,
        salt: 'salt',
        passwordHash: scryptSync('Sup3rSecret!', 'salt', 64).toString('hex'),
      });
    });

    it('refuse un mot de passe actuel incorrect, sans rien modifier', async () => {
      await expect(
        service.changePassword('user-1', 'session-1', {
          currentPassword: 'Wr0ng!pass',
          password: 'N3wSecret!',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });

    it('enregistre le nouveau mot de passe haché avec un nouveau salt', async () => {
      await service.changePassword('user-1', 'session-1', {
        currentPassword: 'Sup3rSecret!',
        password: 'N3wSecret!',
      });

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(data.salt).not.toBe('salt');
      expect(data.passwordHash).toBe(
        scryptSync('N3wSecret!', data.salt, 64).toString('hex'),
      );
    });

    it('ferme les autres sessions et garde la session en cours', async () => {
      await service.changePassword('user-1', 'session-1', {
        currentPassword: 'Sup3rSecret!',
        password: 'N3wSecret!',
      });

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', id: { not: 'session-1' } },
      });
    });
  });
});
