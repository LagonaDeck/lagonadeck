import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../common/password.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { pseudo: dto.pseudo }] },
    });
    if (exists) {
      throw new ConflictException('Email ou pseudo déjà utilisé');
    }

    const { hash, salt } = await this.passwordService.hash(dto.password);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        pseudo: dto.pseudo,
        passwordHash: hash,
        salt,
      },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id); // vérifie l'existence

    if (dto.email || dto.pseudo) {
      const conflict = await this.prisma.user.findFirst({
        where: {
          id: { not: id },
          OR: [
            dto.email ? { email: dto.email } : undefined,
            dto.pseudo ? { pseudo: dto.pseudo } : undefined,
          ].filter(Boolean) as any,
        },
      });
      if (conflict) throw new ConflictException('Email ou pseudo déjà utilisé');
    }

    return this.prisma.user.update({ where: { id }, data: dto });
  }
}