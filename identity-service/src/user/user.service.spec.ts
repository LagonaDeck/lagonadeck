import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { scryptSync } from 'node:crypto';
import { UserService } from './user.service';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { InvitationService } from '../organization/invitation.service';
import { OrganizationService } from '../organization/organization.service';
import { hashToken } from '../session/utils/token.util';

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
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    session: { deleteMany: jest.Mock };
    emailConfirmation: {
      findUnique: jest.Mock;
      deleteMany: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let mailService: { send: jest.Mock };
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
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      session: { deleteMany: jest.fn() },
      emailConfirmation: {
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
    };
    mailService = { send: jest.fn() };
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
        { provide: MailService, useValue: mailService },
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

    it("envoie le lien de confirmation et n'en stocke que le hash, valable 24 h", async () => {
      prisma.user.create.mockResolvedValue(baseUser);

      await service.create(dto);

      const { emailConfirmation } = prisma.user.create.mock.calls[0][0].data;
      const [[mail]] = mailService.send.mock.calls;
      expect(mail).toMatchObject({
        template: 'account-confirmation',
        to: baseUser.email,
        username: baseUser.username,
      });
      expect(emailConfirmation.create.tokenHash).toBe(hashToken(mail.token));
      expect(emailConfirmation.create.expiresAt.getTime()).toBeCloseTo(
        Date.now() + 24 * 60 * 60 * 1000,
        -4,
      );
    });

    it('convertit une violation de contrainte unique (P2002) en 409, sans e-mail', async () => {
      prisma.user.create.mockRejectedValue(uniqueConstraintError());

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mailService.send).not.toHaveBeenCalled();
    });

    it('propage les autres erreurs sans les convertir', async () => {
      const dbError = new Error('connexion perdue');
      prisma.user.create.mockRejectedValue(dbError);

      await expect(service.create(dto)).rejects.toBe(dbError);
    });
  });

  describe('confirmEmail', () => {
    const confirmation = (expiresAt: Date) => ({
      tokenHash: hashToken('token'),
      userId: 'user-1',
      expiresAt,
    });

    it("confirme l'adresse et consomme le lien", async () => {
      prisma.emailConfirmation.findUnique.mockResolvedValue(
        confirmation(new Date(Date.now() + 60_000)),
      );

      await service.confirmEmail('token');

      expect(prisma.emailConfirmation.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: hashToken('token') },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailConfirmedAt: expect.any(Date) },
      });
      expect(prisma.emailConfirmation.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: hashToken('token') },
      });
    });

    it.each([
      ['inconnu', null],
      ['expiré', confirmation(new Date(Date.now() - 1))],
    ])('refuse un lien %s', async (_, found) => {
      prisma.emailConfirmation.findUnique.mockResolvedValue(found);

      await expect(service.confirmEmail('token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('resendConfirmation', () => {
    const unconfirmed = (sentAt: Date) => ({
      ...baseUser,
      emailConfirmedAt: null,
      emailConfirmation: { createdAt: sentAt },
    });

    it('remplace le lien précédent et envoie le nouveau', async () => {
      prisma.user.findUnique.mockResolvedValue(
        unconfirmed(new Date(Date.now() - 2 * 60_000)),
      );

      await service.resendConfirmation(baseUser.email);

      const { create, update } =
        prisma.emailConfirmation.upsert.mock.calls[0][0];
      const [[mail]] = mailService.send.mock.calls;
      expect(update.tokenHash).toBe(hashToken(mail.token));
      expect(create).toMatchObject({ ...update, userId: baseUser.id });
    });

    it.each([
      ['une adresse sans compte', null],
      [
        'un compte déjà confirmé',
        { ...baseUser, emailConfirmedAt: new Date(), emailConfirmation: null },
      ],
      ["un lien envoyé il y a moins d'une minute", unconfirmed(new Date())],
    ])("n'envoie rien pour %s", async (_, user) => {
      prisma.user.findUnique.mockResolvedValue(user);

      await service.resendConfirmation(baseUser.email);

      expect(prisma.emailConfirmation.upsert).not.toHaveBeenCalled();
      expect(mailService.send).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    beforeEach(() => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(baseUser);
    });

    it("modifie l'utilisateur connecté et recalcule la clé d'unicité du nom", async () => {
      prisma.user.update.mockResolvedValue(baseUser);

      await service.updateProfile('user-1', { username: 'Janet42' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { username: 'Janet42', usernameNormalized: 'janet42' },
      });
      expect(mailService.send).not.toHaveBeenCalled();
    });

    it('redemande la confirmation de la nouvelle adresse, sans toucher au nom', async () => {
      const updated = { ...baseUser, email: 'janet@example.com' };
      prisma.user.update.mockResolvedValue(updated);

      await service.updateProfile('user-1', { email: 'janet@example.com' });

      const { data } = prisma.user.update.mock.calls[0][0];
      const [[mail]] = mailService.send.mock.calls;
      expect(data).toMatchObject({
        email: 'janet@example.com',
        emailConfirmedAt: null,
      });
      expect(data).not.toHaveProperty('usernameNormalized');
      expect(data.emailConfirmation.upsert.update.tokenHash).toBe(
        hashToken(mail.token),
      );
      expect(mail).toMatchObject({
        template: 'account-confirmation',
        to: 'janet@example.com',
      });
    });

    it("ne redemande rien quand l'adresse envoyée est l'adresse actuelle", async () => {
      prisma.user.update.mockResolvedValue(baseUser);

      await service.updateProfile('user-1', { email: baseUser.email });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { email: baseUser.email },
      });
      expect(mailService.send).not.toHaveBeenCalled();
    });

    it('convertit une violation de contrainte unique (P2002) en 409, sans e-mail', async () => {
      prisma.user.update.mockRejectedValue(uniqueConstraintError());

      await expect(
        service.updateProfile('user-1', { email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mailService.send).not.toHaveBeenCalled();
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
