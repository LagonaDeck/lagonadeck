import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { hashPassword } from '../user/utils/password.util';
import { LoginThrottleService } from './login-throttle.service';
import { SessionService } from './session.service';
import { hashToken } from './utils/token.util';

const notFound = () =>
  new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '7.10.0',
  });

describe('SessionService', () => {
  let service: SessionService;
  let prisma: {
    user: { findUnique: jest.Mock };
    session: {
      create: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      session: {
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        SessionService,
        LoginThrottleService,
        { provide: PrismaClient, useValue: prisma },
      ],
    }).compile();
    service = module.get(SessionService);
  });

  describe('login', () => {
    beforeEach(async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        salt: 'salt',
        passwordHash: await hashPassword('Sup3rSecret!', 'salt'),
      });
    });

    it('ouvre une session et ne stocke que les hash des tokens', async () => {
      const session = await service.login({
        email: 'jane@example.com',
        password: 'Sup3rSecret!',
      });

      const { data } = prisma.session.create.mock.calls[0][0];
      expect(data).toMatchObject({
        id: hashToken(session.token),
        refreshTokenHash: hashToken(session.refreshToken),
        userId: 'user-1',
      });
      expect(session.token).not.toBe(session.refreshToken);
    });

    it('refuse un mauvais mot de passe', async () => {
      await expect(
        service.login({ email: 'jane@example.com', password: 'Wr0ng!pass' }),
      ).rejects.toThrow(new UnauthorizedException('Identifiants invalides'));
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('refuse un email inconnu avec la même erreur', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nobody@example.com',
          password: 'Sup3rSecret!',
        }),
      ).rejects.toThrow(new UnauthorizedException('Identifiants invalides'));
    });
  });

  describe('refresh', () => {
    it('remplace la session par une nouvelle paire de tokens', async () => {
      prisma.session.delete.mockResolvedValue({
        userId: 'user-1',
        refreshExpiresAt: new Date(Date.now() + 60_000),
      });

      const session = await service.refresh('old-refresh');

      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { refreshTokenHash: hashToken('old-refresh') },
      });
      expect(session.refreshToken).not.toBe('old-refresh');
      expect(prisma.session.create.mock.calls[0][0].data.userId).toBe('user-1');
    });

    it('refuse un refresh token inconnu ou déjà utilisé', async () => {
      prisma.session.delete.mockRejectedValue(notFound());

      await expect(service.refresh('used')).rejects.toThrow(
        new UnauthorizedException('Session invalide'),
      );
    });

    it('refuse un refresh token expiré', async () => {
      prisma.session.delete.mockResolvedValue({
        userId: 'user-1',
        refreshExpiresAt: new Date(Date.now() - 1),
      });

      await expect(service.refresh('expired')).rejects.toThrow(
        new UnauthorizedException('Session invalide'),
      );
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('propage les autres erreurs de base', async () => {
      const dbError = new Error('connexion perdue');
      prisma.session.delete.mockRejectedValue(dbError);

      await expect(service.refresh('any')).rejects.toBe(dbError);
    });
  });

  describe('findUser', () => {
    it("renvoie l'utilisateur d'une session valide", async () => {
      const user = { id: 'user-1', username: 'JaneDoe' };
      prisma.session.findUnique.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user,
      });

      await expect(service.findUser('token')).resolves.toBe(user);
      expect(prisma.session.findUnique).toHaveBeenCalledWith({
        where: { id: hashToken('token') },
        include: { user: true },
      });
    });

    it.each([
      ['inconnue', null],
      ['expirée', { expiresAt: new Date(Date.now() - 1), user: {} }],
    ])('refuse une session %s', async (_, session) => {
      prisma.session.findUnique.mockResolvedValue(session);

      await expect(service.findUser('token')).rejects.toThrow(
        new UnauthorizedException('Session invalide'),
      );
    });
  });

  it('logout supprime la session du refresh token', async () => {
    await service.logout('refresh');

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { refreshTokenHash: hashToken('refresh') },
    });
  });

  it('bloque le login après 5 échecs, même avec le bon mot de passe', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      salt: 'salt',
      passwordHash: await hashPassword('Sup3rSecret!', 'salt'),
    });
    for (let i = 0; i < 5; i++) {
      await expect(
        service.login({ email: 'jane@example.com', password: 'Wr0ng!pass' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    await expect(
      service.login({ email: 'jane@example.com', password: 'Sup3rSecret!' }),
    ).rejects.toThrow('Trop de tentatives de connexion');
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('purge les sessions dont le refresh token a expiré', async () => {
    await service.purgeExpired();

    const { where } = prisma.session.deleteMany.mock.calls[0][0];
    expect(where.refreshExpiresAt.lt).toBeInstanceOf(Date);
  });
});
