import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
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
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

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
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly organizationService: OrganizationService,
    private readonly invitationService: InvitationService,
    private readonly mailService: MailService,
  ) {}

  onModuleInit() {
    setInterval(
      () =>
        void this.purgeUnconfirmed().catch((error) =>
          this.logger.error(`Échec de la purge des comptes : ${error}`),
        ),
      PURGE_INTERVAL_MS,
    ).unref();
  }

  // Organisations et invitations attendent la confirmation : avant, rien ne
  // prouve que le compte appartient à la personne de l'adresse.
  async create(dto: CreateUserDto) {
    const salt = generateSalt();
    const passwordHash = await hashPassword(dto.password, salt);
    const confirmation = newConfirmation();

    // Pas de pré-contrôle avant l'écriture : il ne serait pas atomique, la
    // contrainte unique en base reste la seule source de vérité.
    const user = await this.prisma.user
      .create({
        data: {
          email: dto.email,
          username: dto.username,
          usernameNormalized: normalizeUsername(dto.username),
          passwordHash,
          salt,
          emailConfirmation: {
            create: {
              ...confirmation.data,
              invitationOrganizationId: dto.invitationOrganizationId,
            },
          },
        },
      })
      .catch(rethrowConflict);
    this.sendConfirmation(user, confirmation.token);
    return user;
  }

  // Un compte jamais confirmé libère son adresse : sinon n'importe qui
  // pourrait la bloquer en s'inscrivant à la place de sa propriétaire.
  async purgeUnconfirmed(): Promise<void> {
    await this.prisma.user.deleteMany({
      where: {
        emailConfirmedAt: null,
        emailConfirmation: { is: { expiresAt: { lt: new Date() } } },
      },
    });
  }

  async confirmEmail(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    const confirmation = await this.prisma.emailConfirmation.findUnique({
      where: { tokenHash },
    });
    if (!confirmation || confirmation.expiresAt <= new Date()) {
      throw new BadRequestException('Lien de confirmation invalide ou expiré');
    }
    await this.prisma
      .$transaction(async (tx) => {
        // Deux clics simultanés sur le lien : seul le premier l'applique.
        const { count } = await tx.emailConfirmation.deleteMany({
          where: { tokenHash },
        });
        if (count === 0) return;

        const user = await tx.user.findUniqueOrThrow({
          where: { id: confirmation.userId },
        });
        if (user.pendingEmail) {
          await this.applyPendingEmail(tx, user.id, user.pendingEmail);
        } else if (!user.emailConfirmedAt) {
          await this.activate(
            tx,
            user.id,
            confirmation.invitationOrganizationId,
          );
        }
      })
      .catch(rethrowConflict);
  }

  private async activate(
    tx: Prisma.TransactionClient,
    userId: string,
    invitationOrganizationId: string | null,
  ): Promise<void> {
    const user = await tx.user.update({
      where: { id: userId },
      data: { emailConfirmedAt: new Date() },
    });
    await this.invitationService.claimEmailInvitations(tx, user);
    // Une invitation révoquée depuis le signup ne bloque pas la confirmation :
    // le compte reçoit alors une organisation personnelle.
    const invitation =
      invitationOrganizationId &&
      (await tx.invitation.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitationOrganizationId,
            userId,
          },
        },
      }));
    // Un compte qui rejoint une organisation en s'inscrivant n'a pas
    // d'organisation personnelle.
    if (invitation) {
      await this.invitationService.acceptIn(
        tx,
        userId,
        invitation.organizationId,
      );
    } else {
      await this.organizationService.createPersonal(tx, user);
    }
  }

  private async applyPendingEmail(
    tx: Prisma.TransactionClient,
    userId: string,
    email: string,
  ): Promise<void> {
    const user = await tx.user.update({
      where: { id: userId },
      data: { email, pendingEmail: null },
    });
    await this.invitationService.claimEmailInvitations(tx, user);
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
      to: user.pendingEmail ?? user.email,
      username: user.username,
      token,
    });
  }

  async updateProfile(userId: string, { email, ...dto }: UpdateProfileDto) {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    // Une nouvelle adresse se prouve comme à l'inscription. D'ici là,
    // l'ancienne reste celle du compte : une faute de frappe ne le bloque pas.
    const confirmation =
      email !== undefined && email !== current.email
        ? newConfirmation()
        : undefined;
    // La contrainte unique sur `email` tranche à la confirmation : ce contrôle
    // évite seulement d'envoyer un lien voué à l'échec.
    if (
      confirmation &&
      (await this.prisma.user.findUnique({ where: { email } }))
    ) {
      throw new ConflictException('Email déjà utilisé');
    }

    const user = await this.prisma.user
      .update({
        where: { id: userId },
        data: {
          ...dto,
          ...(dto.username !== undefined && {
            usernameNormalized: normalizeUsername(dto.username),
          }),
          ...(email !== undefined && {
            pendingEmail: confirmation ? email : null,
          }),
          ...(confirmation && {
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
