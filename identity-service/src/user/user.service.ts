import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { CreateUserDto } from './models/dtos/user.dto';
import { generateSalt, hashPassword } from './utils/password.util';
import { normalizeUsername } from './utils/username.util';

@Injectable()
export class UserService {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async create(dto: CreateUserDto) {
    const salt = generateSalt();
    const passwordHash = await hashPassword(dto.password, salt);

    // Pas de pré-contrôle avant l'écriture : il ne serait pas atomique, la
    // contrainte unique en base reste la seule source de vérité.
    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          usernameNormalized: normalizeUsername(dto.username),
          passwordHash,
          salt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email ou nom d’utilisateur déjà utilisé');
      }
      throw error;
    }
  }
}
