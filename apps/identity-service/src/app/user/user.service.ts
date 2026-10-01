import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../common/password.service';
import { normalizeEmail, normalizePseudo } from '../common/normalize';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma } from '../../generated/prisma/client';

/** Code Prisma d'une violation de contrainte unique (index email/pseudo). */
const UNIQUE_CONSTRAINT_VIOLATION_CODE = 'P2002';
/** Code Prisma d'un enregistrement introuvable lors d'une écriture. */
const RECORD_NOT_FOUND_CODE = 'P2025';

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
          pseudoNormalized: normalizePseudo(dto.pseudo),
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
    const data =
      dto.pseudo === undefined
        ? dto
        : { ...dto, pseudoNormalized: normalizePseudo(dto.pseudo) };

    return this.writeOrConflict(() =>
      this.prisma.user.update({ where: { id }, data }),
    );
  }

  /**
   * Exécute une écriture Prisma et traduit ses erreurs attendues en réponse
   * HTTP : violation de l'index unique (email/pseudo, P2002) en 409,
   * enregistrement introuvable (P2025) en 404.
   *
   * Il n'y a volontairement pas de pré-contrôle applicatif (`findFirst`,
   * `findById`) avant l'écriture : un tel contrôle n'est pas atomique avec
   * l'écriture qui suit. Deux requêtes concurrentes le passeraient toutes les
   * deux, et l'écriture échouerait quand même en base. La base reste donc la
   * seule source de vérité ; ce wrapper se contente de traduire son erreur.
   */
  private async writeOrConflict<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === UNIQUE_CONSTRAINT_VIOLATION_CODE) {
          throw new ConflictException('Email ou pseudo déjà utilisé');
        }
        if (error.code === RECORD_NOT_FOUND_CODE) {
          throw new NotFoundException('Utilisateur introuvable');
        }
      }
      throw error;
    }
  }
}
