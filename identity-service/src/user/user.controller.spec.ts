import { Test } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { SessionService } from '../session/session.service';
import { UserPublicDto } from './models/dtos/user.dto';

describe('UserController', () => {
  let controller: UserController;
  let service: {
    create: jest.Mock;
  };

  const userEntity = {
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
    service = {
      create: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: service },
        { provide: SessionService, useValue: {} },
      ],
    }).compile();

    controller = module.get(UserController);
  });

  it('crée un utilisateur et renvoie sa version publique, sans le hash du mot de passe', async () => {
    service.create.mockResolvedValue(userEntity);
    const dto = {
      email: 'jane@example.com',
      username: 'JaneDoe',
      password: 'Sup3rSecret!',
    };

    const result = await controller.createUser(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toBeInstanceOf(UserPublicDto);
    expect(result).toEqual({
      id: 'user-1',
      username: 'JaneDoe',
      createdAt: userEntity.createdAt,
      updatedAt: userEntity.updatedAt,
    });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('salt');
    expect(result).not.toHaveProperty('usernameNormalized');
  });
});
