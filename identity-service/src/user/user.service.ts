import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { InvitationService } from '../organization/invitation.service';
import { OrganizationService } from '../organization/organization.service';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateProfileDto,
} from './models/dtos/user.dto';
import {
  generateSalt,
  hashPassword,
  verifyPassword,
} from './utils/password.util';
import { normalizeUsername } from './utils/username.util';

@Injectable()
export class UserService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly organizationService: OrganizationService,
    private readonly invitationService: InvitationService,
  ) {}

  async create(dto: CreateUserDto) {
    const salt = generateSalt();
    const passwordHash = await hashPassword(dto.password, salt);

    // Pas de pré-contrôle avant l'écriture : il ne serait pas atomique, la
    // contrainte unique en base reste la seule source de vérité.
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            username: dto.username,
            usernameNormalized: normalizeUsername(dto.username),
            passwordHash,
            salt,
          },
        });
        await this.invitationService.claimEmailInvitations(tx, user);
        // Un compte qui rejoint une organisation en s'inscrivant n'a pas
        // d'organisation personnelle.
        if (dto.invitationOrganizationId) {
          await this.invitationService.acceptIn(
            tx,
            user.id,
            dto.invitationOrganizationId,
          );
        } else {
          await this.organizationService.createPersonal(tx, user);
        }
        return user;
      });
    } catch (error) {
      rethrowConflict(error);
    }
  }

  updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user
      .update({
        where: { id: userId },
        data: {
          ...dto,
          ...(dto.username !== undefined && {
            usernameNormalized: normalizeUsername(dto.username),
          }),
        },
      })
      .catch(rethrowConflict);
  }

  // Les autres sessions sont fermées : un accès volé ne survit pas au changement.
  async changePassword(
    userId: string,
    currentSessionId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (
      !(await verifyPassword(dto.currentPassword, user.passwordHash, user.salt))
    ) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(dto.password, salt);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, salt },
      }),
      this.prisma.session.deleteMany({
        where: { userId, id: { not: currentSessionId } },
      }),
    ]);
  }
}

function rethrowConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException('Email ou nom d’utilisateur déjà utilisé');
  }
  throw error;
}
