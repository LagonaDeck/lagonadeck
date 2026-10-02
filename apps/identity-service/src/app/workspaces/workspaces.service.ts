import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { writeOrConflict } from '../common/prisma-errors';
import { WorkspaceRole } from '../../generated/prisma/enums';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import {
  WorkspaceDto,
  WorkspaceInvitationDto,
  WorkspaceMemberDto,
} from './dto/workspace.dto';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ROLE_RANK: Record<WorkspaceRole, number> = {
  MEMBER: 0,
  ADMIN: 1,
  OWNER: 2,
};

/** Un ADMIN ne peut ni rétrograder ni retirer un ADMIN : seul le OWNER en invite. */
function inviterRoleFor(role: WorkspaceRole): WorkspaceRole {
  return role === WorkspaceRole.ADMIN
    ? WorkspaceRole.OWNER
    : WorkspaceRole.ADMIN;
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserService,
  ) {}

  async create(userId: string, name: string): Promise<WorkspaceDto> {
    await this.users.findById(userId);
    const workspace = await this.prisma.workspace.create({
      data: {
        name,
        members: { create: { userId, role: WorkspaceRole.OWNER } },
      },
    });
    return WorkspaceDto.fromEntity(workspace, WorkspaceRole.OWNER);
  }

  async findMine(userId: string): Promise<WorkspaceDto[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => WorkspaceDto.fromEntity(m.workspace, m.role));
  }

  async findOne(userId: string, workspaceId: string): Promise<WorkspaceDto> {
    const membership = await this.requireRole(
      userId,
      workspaceId,
      WorkspaceRole.MEMBER,
    );
    return WorkspaceDto.fromEntity(membership.workspace, membership.role);
  }

  async rename(
    userId: string,
    workspaceId: string,
    name: string,
  ): Promise<WorkspaceDto> {
    const { role } = await this.requireRole(
      userId,
      workspaceId,
      WorkspaceRole.ADMIN,
    );
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name },
    });
    return WorkspaceDto.fromEntity(workspace, role);
  }

  async remove(userId: string, workspaceId: string): Promise<void> {
    await this.requireRole(userId, workspaceId, WorkspaceRole.OWNER);
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  async listMembers(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMemberDto[]> {
    await this.requireRole(userId, workspaceId, WorkspaceRole.MEMBER);
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => WorkspaceMemberDto.fromEntity(m));
  }

  /** Réservé au propriétaire ; `OWNER` transfère la propriété. */
  async updateMemberRole(
    userId: string,
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole,
  ): Promise<void> {
    await this.requireRole(userId, workspaceId, WorkspaceRole.OWNER);
    if (memberId === userId) {
      throw new BadRequestException(
        'Le propriétaire change de rôle en transférant la propriété à un autre membre.',
      );
    }
    await this.getMemberOrThrow(workspaceId, memberId);
    const errors = {
      conflict: 'La propriété de ce workspace vient de changer.',
      notFound: `Membre introuvable : ${memberId}`,
    };

    if (role === WorkspaceRole.OWNER) {
      // L'ancien propriétaire est rétrogradé avant la promotion : l'index
      // unique partiel interdit deux OWNER, même un instant.
      await writeOrConflict(
        () =>
          this.prisma.$transaction([
            this.prisma.workspaceMember.update({
              where: { workspaceId_userId: { workspaceId, userId } },
              data: { role: WorkspaceRole.ADMIN },
            }),
            this.prisma.workspaceMember.update({
              where: { workspaceId_userId: { workspaceId, userId: memberId } },
              data: { role: WorkspaceRole.OWNER },
            }),
            this.prisma.workspaceInvitation.deleteMany({
              where: { workspaceId, invitedById: userId },
            }),
          ]),
        errors,
      );
      return;
    }

    await writeOrConflict(
      () =>
        this.prisma.workspaceMember.update({
          where: { workspaceId_userId: { workspaceId, userId: memberId } },
          data: { role },
        }),
      errors,
    );
  }

  /** Un membre peut quitter le workspace, ou retirer un membre de rôle inférieur au sien. */
  async removeMember(
    userId: string,
    workspaceId: string,
    memberId: string,
  ): Promise<void> {
    const actor = await this.requireRole(
      userId,
      workspaceId,
      WorkspaceRole.MEMBER,
    );
    const target = await this.getMemberOrThrow(workspaceId, memberId);

    if (target.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException(
        'Le propriétaire doit transférer la propriété avant de quitter le workspace.',
      );
    }
    if (
      memberId !== userId &&
      ROLE_RANK[actor.role] <= ROLE_RANK[target.role]
    ) {
      throw new ForbiddenException(
        'Seul un membre de rôle supérieur peut retirer ce membre.',
      );
    }

    await writeOrConflict(
      () =>
        this.prisma.workspaceMember.delete({
          where: { workspaceId_userId: { workspaceId, userId: memberId } },
        }),
      { notFound: `Membre introuvable : ${memberId}` },
    );
  }

  /** Ré-inviter une adresse met à jour le rôle et repousse l'expiration. */
  async invite(
    userId: string,
    workspaceId: string,
    dto: CreateInvitationDto,
  ): Promise<WorkspaceInvitationDto> {
    await this.requireRole(userId, workspaceId, inviterRoleFor(dto.role));

    const alreadyMember = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        user: { email: dto.email },
      },
    });
    if (alreadyMember) {
      throw new ConflictException(
        'Cette adresse est déjà membre du workspace.',
      );
    }

    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitation = await this.prisma.workspaceInvitation.upsert({
      where: { workspaceId_email: { workspaceId, email: dto.email } },
      create: {
        workspaceId,
        email: dto.email,
        role: dto.role,
        invitedById: userId,
        expiresAt,
      },
      update: { role: dto.role, invitedById: userId, expiresAt },
      include: { workspace: true },
    });
    return WorkspaceInvitationDto.fromEntity(invitation);
  }

  /** Invitations non expirées : celles que l'invité peut encore accepter. */
  async listInvitations(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceInvitationDto[]> {
    await this.requireRole(userId, workspaceId, WorkspaceRole.ADMIN);
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId, expiresAt: { gt: new Date() } },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return invitations.map((i) => WorkspaceInvitationDto.fromEntity(i));
  }

  async revokeInvitation(
    userId: string,
    workspaceId: string,
    invitationId: string,
  ): Promise<void> {
    await this.requireRole(userId, workspaceId, WorkspaceRole.ADMIN);
    const { count } = await this.prisma.workspaceInvitation.deleteMany({
      where: { id: invitationId, workspaceId },
    });
    if (count === 0) {
      throw new NotFoundException(`Invitation introuvable : ${invitationId}`);
    }
  }

  /** Invitations non expirées adressées à l'utilisateur appelant. */
  async findMyInvitations(userId: string): Promise<WorkspaceInvitationDto[]> {
    const user = await this.users.findById(userId);
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: { email: user.email, expiresAt: { gt: new Date() } },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return invitations.map((i) => WorkspaceInvitationDto.fromEntity(i));
  }

  async acceptInvitation(
    userId: string,
    invitationId: string,
  ): Promise<WorkspaceDto> {
    const invitation = await this.getInvitationForUser(userId, invitationId);
    if (invitation.expiresAt <= new Date()) {
      throw new GoneException('Cette invitation a expiré.');
    }
    const inviter = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: invitation.invitedById,
        },
      },
    });
    // L'auteur a pu être rétrogradé ou retiré depuis l'envoi.
    if (
      !inviter ||
      ROLE_RANK[inviter.role] < ROLE_RANK[inviterRoleFor(invitation.role)]
    ) {
      throw new GoneException("Cette invitation n'est plus valide.");
    }

    const [membership] = await writeOrConflict(
      () =>
        this.prisma.$transaction([
          this.prisma.workspaceMember.create({
            data: {
              workspaceId: invitation.workspaceId,
              userId,
              role: invitation.role,
            },
            include: { workspace: true },
          }),
          this.prisma.workspaceInvitation.delete({
            where: { id: invitationId },
          }),
        ]),
      {
        conflict: 'Vous êtes déjà membre de ce workspace.',
        notFound: `Invitation introuvable : ${invitationId}`,
      },
    );
    return WorkspaceDto.fromEntity(membership.workspace, membership.role);
  }

  async declineInvitation(userId: string, invitationId: string): Promise<void> {
    const user = await this.users.findById(userId);
    const { count } = await this.prisma.workspaceInvitation.deleteMany({
      where: { id: invitationId, email: user.email },
    });
    if (count === 0) {
      throw new NotFoundException(`Invitation introuvable : ${invitationId}`);
    }
  }

  /**
   * Renvoie l'appartenance de l'utilisateur, ou 404 s'il n'est pas membre :
   * un non-membre ne doit pas pouvoir deviner qu'un workspace existe.
   */
  private async requireRole(
    userId: string,
    workspaceId: string,
    minRole: WorkspaceRole,
  ) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { workspace: true },
    });
    if (!membership) {
      throw new NotFoundException(`Workspace introuvable : ${workspaceId}`);
    }
    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException(`Rôle ${minRole} requis.`);
    }
    return membership;
  }

  private async getMemberOrThrow(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) {
      throw new NotFoundException(`Membre introuvable : ${userId}`);
    }
    return member;
  }

  private async getInvitationForUser(userId: string, invitationId: string) {
    const user = await this.users.findById(userId);
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.email !== user.email) {
      throw new NotFoundException(`Invitation introuvable : ${invitationId}`);
    }
    return invitation;
  }
}
