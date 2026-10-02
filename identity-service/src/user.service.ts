import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { Prisma, PrismaClient } from './generated/prisma/client';
import { CreateUserDto, UpdateUserDto } from './user.dto';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

@Injectable()
export class UserService {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async create(dto: CreateUserDto) {
    const salt = randomBytes(16).toString('hex');
    const passwordHash = (await scryptAsync(dto.password, salt, 64)).toString(
      'hex',
    );

    return this.writeOrConflict(() =>
      this.prisma.user.create({
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          pseudo: dto.pseudo,
          pseudoNormalized: dto.pseudo.toLowerCase(),
          passwordHash,
          salt,
        },
      }),
    );
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const data =
      dto.pseudo === undefined
        ? dto
        : { ...dto, pseudoNormalized: dto.pseudo.toLowerCase() };

    return this.writeOrConflict(() =>
      this.prisma.user.update({ where: { id }, data }),
    );
  }

  // Pas de pré-contrôle avant l'écriture : il ne serait pas atomique, la
  // contrainte unique en base reste la seule source de vérité.
  private async writeOrConflict<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Email ou pseudo déjà utilisé');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Utilisateur introuvable');
        }
      }
      throw error;
    }
  }
}
