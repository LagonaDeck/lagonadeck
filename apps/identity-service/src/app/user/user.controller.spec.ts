import { Test } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserPublicDto } from './dto/user-public.dto';

describe('UserController', () => {
  let controller: UserController;
  let service: {
    create: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
  };

  const userEntity = {
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
    service = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: service }],
    }).compile();

    controller = module.get(UserController);
  });

  it('crée un utilisateur et renvoie sa version publique, sans le hash du mot de passe', async () => {
    service.create.mockResolvedValue(userEntity);
    const dto = {
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      pseudo: 'janedoe',
      password: 'Sup3rSecret!',
    };

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toBeInstanceOf(UserPublicDto);
    expect(result).toEqual({
      id: 'user-1',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      pseudo: 'janedoe',
      createdAt: userEntity.createdAt,
      updatedAt: userEntity.updatedAt,
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('salt');
  });

  it('récupère un utilisateur par id', async () => {
    service.findById.mockResolvedValue(userEntity);

    const result = await controller.findOne('user-1');

    expect(service.findById).toHaveBeenCalledWith('user-1');
    expect(result).toBeInstanceOf(UserPublicDto);
    expect(result.id).toBe('user-1');
  });

  it('met à jour un utilisateur et renvoie sa version publique', async () => {
    service.update.mockResolvedValue({ ...userEntity, firstName: 'Janet' });

    const result = await controller.update('user-1', { firstName: 'Janet' });

    expect(service.update).toHaveBeenCalledWith('user-1', {
      firstName: 'Janet',
    });
    expect(result).toBeInstanceOf(UserPublicDto);
    expect(result.firstName).toBe('Janet');
  });
});
