import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../common/password.service';
import { normalizeEmail } from '../common/normalize';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma } from '../../generated/prisma/client';

/** Code Prisma d'une violation de contrainte unique (index email/pseudo). */
const UNIQUE_CONSTRAINT_VIOLATION_CODE = 'P2002';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async create(dto: CreateUserDto) {
    const { hash, salt } = await this.passwordService.hash(dto.password);

    return this.writeOrConflict(() =>
      this.prisma.user.create({
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          pseudo: dto.pseudo,
          passwordHash: hash,
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

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id); // vérifie l'existence

    return this.writeOrConflict(() =>
      this.prisma.user.update({ where: { id }, data: dto }),
    );
  }

  /**
   * Exécute une écriture Prisma et convertit une violation de l'index unique
   * (email/pseudo, code P2002) en 409 explicite.
   *
   * Il n'y a volontairement pas de pré-contrôle applicatif (`findFirst`) avant
   * l'écriture : un tel contrôle n'est pas atomique avec l'écriture qui suit,
   * donc deux requêtes concurrentes avec le même email/pseudo le passeraient
   * toutes les deux, et la seconde écriture échouerait quand même sur l'index.
   * L'index unique en base reste donc la seule source de vérité ; ce wrapper
   * se contente de traduire son erreur en réponse HTTP appropriée.
   */
  private async writeOrConflict<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION_CODE
      ) {
        throw new ConflictException('Email ou pseudo déjà utilisé');
      }
      throw error;
    }
  }
}
