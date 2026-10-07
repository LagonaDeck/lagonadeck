import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import {
  InvitableUserDto,
  PendingInvitationDto,
  ReceivedInvitationDto,
} from './models/dtos/invitation.dto';
import { MyOrganizationDto } from './models/dtos/organization.dto';
import { OrganizationAccessService } from './organization-access.service';
import { assertCanJoinOrganization } from './utils/membership.util';

const SEARCH_LIMIT = 5;
const USERNAME_MIN_SEARCH = 3;

// La recherche par nom ne doit pas révéler les adresses : on n'en garde
// que la première lettre et le domaine.
const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  return `${local[0]}•••@${domain}`;
};

const isPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

@Injectable()
export class InvitationService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly access: OrganizationAccessService,
  ) {}

  // Email exact ou début du nom d'utilisateur : la recherche ne permet pas de
  // parcourir l'annuaire des comptes.
  async searchInvitable(
    userId: string,
    organizationId: string,
    query: string,
  ): Promise<InvitableUserDto[]> {
    await this.access.requirePermission(
      userId,
      organizationId,
      'MEMBER_INVITE',
    );
    const term = query.trim().toLowerCase();
    const byEmail = term.includes('@');
    if (!byEmail && term.length < USERNAME_MIN_SEARCH) return [];

    const users = await this.prisma.user.findMany({
      where: {
        ...(byEmail
          ? { email: term }
          : { usernameNormalized: { startsWith: term } }),
        memberships: { none: { organizationId } },
      },
      select: {
        id: true,
        username: true,
        email: true,
        invitationsReceived: {
          where: { organizationId },
          select: { createdAt: true },
        },
      },
      orderBy: { usernameNormalized: 'asc' },
      take: SEARCH_LIMIT,
    });
    return users.map(({ invitationsReceived, email, ...user }) => ({
      ...user,
      email: byEmail ? email : maskEmail(email),
      invited: invitationsReceived.length > 0,
    }));
  }

  async invite(
    userId: string,
    organizationId: string,
    inviteeId: string,
  ): Promise<void> {
    await this.access.requirePermission(
      userId,
      organizationId,
      'MEMBER_INVITE',
    );
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: inviteeId } },
    });
    if (member) throw new ConflictException('Déjà membre de l’organisation');

    try {
      await this.prisma.invitation.create({
        data: { organizationId, userId: inviteeId, invitedById: userId },
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('Une invitation est déjà en attente');
      }
      if (isPrismaError(error, 'P2003')) {
        throw new NotFoundException('Utilisateur introuvable');
      }
      throw error;
    }
  }

  async listPending(
    userId: string,
    organizationId: string,
  ): Promise<PendingInvitationDto[]> {
    await this.access.getPermissions(userId, organizationId);
    const [invitations, emailInvitations] = await Promise.all([
      this.prisma.invitation.findMany({
        where: { organizationId },
        select: {
          userId: true,
          createdAt: true,
          user: { select: { username: true } },
        },
      }),
      this.prisma.emailInvitation.findMany({
        where: { organizationId },
        select: { email: true, createdAt: true },
      }),
    ]);
    return [
      ...invitations.map(({ user, ...invitation }) => ({
        ...invitation,
        username: user.username,
      })),
      ...emailInvitations,
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  // Une adresse qui a déjà un compte reçoit une invitation ordinaire.
  async inviteEmail(
    userId: string,
    organizationId: string,
    email: string,
  ): Promise<void> {
    const account = await this.prisma.user.findUnique({ where: { email } });
    if (account) return this.invite(userId, organizationId, account.id);

    await this.access.requirePermission(
      userId,
      organizationId,
      'MEMBER_INVITE',
    );
    try {
      await this.prisma.emailInvitation.create({
        data: { organizationId, email, invitedById: userId },
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('Une invitation est déjà en attente');
      }
      throw error;
    }
  }

  async revokeEmail(
    userId: string,
    organizationId: string,
    email: string,
  ): Promise<void> {
    await this.access.requirePermission(
      userId,
      organizationId,
      'MEMBER_INVITE',
    );
    await this.prisma.emailInvitation.deleteMany({
      where: { organizationId, email },
    });
  }

  // Appelé dans la transaction du signup : les invitations faites à l'adresse
  // deviennent celles du compte, à accepter ou refuser comme les autres.
  async claimEmailInvitations(
    tx: Prisma.TransactionClient,
    user: { id: string; email: string },
  ): Promise<void> {
    const emailInvitations = await tx.emailInvitation.findMany({
      where: { email: user.email },
    });
    if (emailInvitations.length === 0) return;

    await tx.invitation.createMany({
      data: emailInvitations.map(({ organizationId, invitedById }) => ({
        organizationId,
        userId: user.id,
        invitedById,
      })),
    });
    await tx.emailInvitation.deleteMany({ where: { email: user.email } });
  }

  async revoke(
    userId: string,
    organizationId: string,
    inviteeId: string,
  ): Promise<void> {
    await this.access.requirePermission(
      userId,
      organizationId,
      'MEMBER_INVITE',
    );
    await this.prisma.invitation.deleteMany({
      where: { organizationId, userId: inviteeId },
    });
  }

  async listReceived(userId: string): Promise<ReceivedInvitationDto[]> {
    const invitations = await this.prisma.invitation.findMany({
      where: { userId },
      select: {
        organization: { select: { id: true, name: true } },
        invitedBy: { select: { username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return invitations.map(({ organization, invitedBy }) => ({
      organizationId: organization.id,
      organizationName: organization.name,
      invitedBy: invitedBy.username,
    }));
  }

  accept(userId: string, organizationId: string): Promise<MyOrganizationDto> {
    return this.prisma.$transaction((tx) =>
      this.acceptIn(tx, userId, organizationId),
    );
  }

  // L'invité arrive sans groupe : ses droits se donnent ensuite par les groupes.
  async acceptIn(
    tx: Prisma.TransactionClient,
    userId: string,
    organizationId: string,
  ): Promise<MyOrganizationDto> {
    await assertCanJoinOrganization(tx, userId);
    const { organization } = await tx.invitation
      .delete({
        where: { organizationId_userId: { organizationId, userId } },
        select: {
          organization: { select: { id: true, name: true, plan: true } },
        },
      })
      .catch((error: unknown) => {
        if (isPrismaError(error, 'P2025')) {
          throw new NotFoundException('Invitation introuvable');
        }
        throw error;
      });
    await tx.organizationMember.create({ data: { organizationId, userId } });
    return { ...organization, groups: [] };
  }

  async decline(userId: string, organizationId: string): Promise<void> {
    await this.prisma.invitation.deleteMany({
      where: { organizationId, userId },
    });
  }
}
