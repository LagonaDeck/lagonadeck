import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Prisma, PrismaClient, type User } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { InvitationService } from '../organization/invitation.service';
import { OrganizationService } from '../organization/organization.service';
import { generateToken, hashToken } from '../session/utils/token.util';
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

// Annoncé dans le template `account-confirmation` du mail-service.
const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;
// Le renvoi est public : sans délai, il servirait à inonder une boîte mail.
const CONFIRMATION_RESEND_DELAY_MS = 60 * 1000;

function newConfirmation() {
  const token = generateToken();
  return {
    token,
    data: {
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS),
      createdAt: new Date(),
    },
  };
}

@Injectable()
export class UserService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly organizationService: OrganizationService,
    private readonly invitationService: InvitationService,
    private readonly mailService: MailService,
  ) {}

  async create(dto: CreateUserDto) {
    const salt = generateSalt();
    const passwordHash = await hashPassword(dto.password, salt);
    const confirmation = newConfirmation();

    // Pas de pré-contrôle avant l'écriture : il ne serait pas atomique, la
    // contrainte unique en base reste la seule source de vérité.
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            username: dto.username,
            usernameNormalized: normalizeUsername(dto.username),
            passwordHash,
            salt,
            emailConfirmation: { create: confirmation.data },
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
      this.sendConfirmation(user, confirmation.token);
      return user;
    } catch (error) {
      rethrowConflict(error);
    }
  }

  async confirmEmail(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    const confirmation = await this.prisma.emailConfirmation.findUnique({
      where: { tokenHash },
    });
    if (!confirmation || confirmation.expiresAt <= new Date()) {
      throw new BadRequestException('Lien de confirmation invalide ou expiré');
    }
    // `deleteMany` : un double clic sur le lien ne doit pas échouer.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: confirmation.userId },
        data: { emailConfirmedAt: new Date() },
      }),
      this.prisma.emailConfirmation.deleteMany({ where: { tokenHash } }),
    ]);
  }

  // Même résultat que l'adresse ait un compte ou non : la route ne révèle pas
  // les comptes existants.
  async resendConfirmation(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { emailConfirmation: true },
    });
    if (!user || user.emailConfirmedAt) return;
    const lastSentAt = user.emailConfirmation?.createdAt.getTime() ?? 0;
    if (Date.now() - lastSentAt < CONFIRMATION_RESEND_DELAY_MS) return;

    const confirmation = newConfirmation();
    await this.prisma.emailConfirmation.upsert({
      where: { userId: user.id },
      create: { ...confirmation.data, userId: user.id },
      update: confirmation.data,
    });
    this.sendConfirmation(user, confirmation.token);
  }

  private sendConfirmation(user: User, token: string): void {
    this.mailService.send({
      template: 'account-confirmation',
      to: user.email,
      username: user.username,
      token,
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    // Une nouvelle adresse se prouve comme à l'inscription : sans cela, un
    // compte pourrait prendre l'adresse de quelqu'un d'autre.
    const confirmation =
      dto.email !== undefined && dto.email !== current.email
        ? newConfirmation()
        : undefined;

    const user = await this.prisma.user
      .update({
        where: { id: userId },
        data: {
          ...dto,
          ...(dto.username !== undefined && {
            usernameNormalized: normalizeUsername(dto.username),
          }),
          ...(confirmation && {
            emailConfirmedAt: null,
            emailConfirmation: {
              upsert: { create: confirmation.data, update: confirmation.data },
            },
          }),
        },
      })
      .catch(rethrowConflict);
    if (confirmation) this.sendConfirmation(user, confirmation.token);
    return user;
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
