import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../common/password.service';
import { Prisma } from '../../generated/prisma/client';

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.0',
  });
}

describe('UserService', () => {
  let service: UserService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let passwordService: { hash: jest.Mock; verify: jest.Mock };

  const baseUser = {
    id: 'user-1',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    pseudo: 'janedoe',
    passwordHash: 'hashed',
    salt: 'salt',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    passwordService = {
      hash: jest.fn(),
      verify: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();

    service = module.get(UserService);
  });

  describe('create', () => {
    const dto = {
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      pseudo: 'janedoe',
      password: 'Sup3rSecret!',
    };

    it("hache le mot de passe et crée l'utilisateur", async () => {
      passwordService.hash.mockResolvedValue({ hash: 'hashed', salt: 'salt' });
      prisma.user.create.mockResolvedValue(baseUser);

      const result = await service.create(dto);

      expect(passwordService.hash).toHaveBeenCalledWith(dto.password);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          pseudo: dto.pseudo,
          passwordHash: 'hashed',
          salt: 'salt',
        },
      });
      expect(result).toEqual(baseUser);
    });

    it('convertit une violation de contrainte unique (P2002) en 409', async () => {
      passwordService.hash.mockResolvedValue({ hash: 'hashed', salt: 'salt' });
      prisma.user.create.mockRejectedValue(uniqueConstraintError());

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('propage les autres erreurs sans les convertir', async () => {
      passwordService.hash.mockResolvedValue({ hash: 'hashed', salt: 'salt' });
      const dbError = new Error('connexion perdue');
      prisma.user.create.mockRejectedValue(dbError);

      await expect(service.create(dto)).rejects.toBe(dbError);
    });
  });

  describe('findById', () => {
    it("lève une 404 si l'utilisateur est introuvable", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("renvoie l'utilisateur trouvé", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      await expect(service.findById('user-1')).resolves.toEqual(baseUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });
  });

  describe('findByEmail', () => {
    it('renvoie null si aucun utilisateur ne correspond (pas de 404)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.findByEmail('missing@example.com'),
      ).resolves.toBeNull();
    });

    it("renvoie l'utilisateur trouvé", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      await expect(service.findByEmail(baseUser.email)).resolves.toEqual(
        baseUser,
      );
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: baseUser.email },
      });
    });

    it('normalise (trim + minuscules) avant de chercher', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      await service.findByEmail('  Jane@Example.com  ');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'jane@example.com' },
      });
    });
  });

  describe('update', () => {
    it("lève une 404 si l'utilisateur est introuvable", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { firstName: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('met à jour un utilisateur existant', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue({ ...baseUser, firstName: 'Janet' });

      const result = await service.update('user-1', { firstName: 'Janet' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { firstName: 'Janet' },
      });
      expect(result.firstName).toBe('Janet');
    });

    it('convertit une violation de contrainte unique (P2002) en 409', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockRejectedValue(uniqueConstraintError());

      await expect(
        service.update('user-1', { email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
