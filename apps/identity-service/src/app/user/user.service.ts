import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../common/password.service';
import { normalizeEmail, normalizePseudo } from '../common/normalize';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { writeOrConflict } from '../common/prisma-errors';

const WRITE_ERRORS = {
  conflict: 'Email ou pseudo déjà utilisé',
  notFound: 'Utilisateur introuvable',
};

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async create(dto: CreateUserDto) {
    const { hash, salt } = await this.passwordService.hash(dto.password);

    return writeOrConflict(
      () =>
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
      WRITE_ERRORS,
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

    return writeOrConflict(
      () => this.prisma.user.update({ where: { id }, data }),
      WRITE_ERRORS,
    );
  }
}
