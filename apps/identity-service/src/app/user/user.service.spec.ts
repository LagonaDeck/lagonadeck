import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../common/password.service';

describe('UserService', () => {
  let service: UserService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
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
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
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

    it('rejette si un utilisateur existe déjà avec le même email ou pseudo', async () => {
      prisma.user.findFirst.mockResolvedValue(baseUser);

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ email: dto.email }, { pseudo: dto.pseudo }] },
      });
      expect(passwordService.hash).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("hache le mot de passe et crée l'utilisateur", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
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
  });

  describe('update', () => {
    it("lève une 404 si l'utilisateur est introuvable", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { firstName: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejette si le nouvel email ou pseudo est déjà pris par un autre utilisateur', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.findFirst.mockResolvedValue({
        ...baseUser,
        id: 'other-user',
      });

      await expect(
        service.update('user-1', { email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: { not: 'user-1' },
          OR: [{ email: 'taken@example.com' }],
        },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('ne vérifie aucun conflit si ni email ni pseudo ne changent', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue({ ...baseUser, firstName: 'Janet' });

      const result = await service.update('user-1', { firstName: 'Janet' });

      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { firstName: 'Janet' },
      });
      expect(result.firstName).toBe('Janet');
    });

    it("met à jour l'utilisateur quand email/pseudo changent sans conflit", async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        pseudo: 'newpseudo',
      });

      const result = await service.update('user-1', { pseudo: 'newpseudo' });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: { not: 'user-1' },
          OR: [{ pseudo: 'newpseudo' }],
        },
      });
      expect(result.pseudo).toBe('newpseudo');
    });
  });
});
