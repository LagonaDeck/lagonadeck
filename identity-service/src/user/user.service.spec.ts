import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { scryptSync } from 'node:crypto';
import { UserService } from './user.service';
import { Prisma, PrismaClient } from '../generated/prisma/client';

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
    user: {
      create: jest.Mock;
    };
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
      user: {
        create: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaClient, useValue: prisma }],
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
});
