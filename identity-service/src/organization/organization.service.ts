import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import {
  MemberDto,
  MyOrganizationDto,
  OrganizationDto,
} from './models/dtos/organization.dto';
import { OrganizationAccessService } from './organization-access.service';
import { assertCanJoinOrganization } from './utils/membership.util';

export const OWNER_GROUP_NAME = 'Owner';
export const MEMBER_GROUP_NAME = 'Member';

const ORGANIZATION_FIELDS = { id: true, name: true, plan: true } as const;

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly access: OrganizationAccessService,
  ) {}

  async listForUser(userId: string): Promise<MyOrganizationDto[]> {
    const organizations = await this.prisma.organization.findMany({
      where: { members: { some: { userId } } },
      select: {
        ...ORGANIZATION_FIELDS,
        members: {
          where: { userId },
          select: {
            groups: {
              select: { group: { select: { name: true } } },
              orderBy: [
                { group: { isOwner: 'desc' } },
                { group: { name: 'asc' } },
              ],
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return organizations.map(({ members, ...organization }) => ({
      ...organization,
      groups: members[0].groups.map(({ group }) => group.name),
    }));
  }

  async get(userId: string, organizationId: string): Promise<OrganizationDto> {
    await this.access.getPermissions(userId, organizationId);
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: ORGANIZATION_FIELDS,
    });
  }

  // La place dans le groupe Owner change de main : l'ancien propriétaire reste
  // membre, sans groupe, et peut alors quitter l'organisation.
  // TODO: faire accepter ou refuser le transfert par le destinataire (notification).
  async transferOwnership(
    userId: string,
    organizationId: string,
    newOwnerId: string,
  ): Promise<void> {
    await this.access.getPermissions(userId, organizationId);
    if (newOwnerId === userId) {
      throw new BadRequestException('Vous êtes déjà le propriétaire');
    }
    await this.prisma.$transaction(async (tx) => {
      // Le verrou sérialise deux transferts simultanés : un seul propriétaire.
      await tx.$queryRaw`SELECT 1 FROM "Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
      const ownership = await tx.groupMember.findFirst({
        where: { organizationId, userId, group: { isOwner: true } },
        select: { groupId: true },
      });
      if (!ownership) {
        throw new ForbiddenException(
          'Réservé au propriétaire de l’organisation',
        );
      }
      await tx.groupMember.delete({
        where: { groupId_userId: { groupId: ownership.groupId, userId } },
      });
      await tx.groupMember
        .create({
          data: {
            groupId: ownership.groupId,
            organizationId,
            userId: newOwnerId,
          },
        })
        .catch((error: unknown) => {
          // La clé étrangère vers OrganizationMember refuse un non-membre.
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2003'
          ) {
            throw new NotFoundException('Membre introuvable');
          }
          throw error;
        });
    });
  }

  // Membres, groupes et invitations suivent par les suppressions en cascade.
  async delete(userId: string, organizationId: string): Promise<void> {
    await this.access.requireOwner(userId, organizationId);
    await this.prisma.organization.delete({ where: { id: organizationId } });
  }

  async rename(
    userId: string,
    organizationId: string,
    name: string,
  ): Promise<OrganizationDto> {
    await this.access.requirePermission(
      userId,
      organizationId,
      'ORGANIZATION_MANAGE',
    );
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { name },
      select: ORGANIZATION_FIELDS,
    });
  }

  async listMembers(
    userId: string,
    organizationId: string,
  ): Promise<MemberDto[]> {
    await this.access.getPermissions(userId, organizationId);
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: {
        userId: true,
        user: { select: { username: true } },
        groups: {
          select: {
            group: { select: { id: true, name: true, isOwner: true } },
          },
          orderBy: [{ group: { isOwner: 'desc' } }, { group: { name: 'asc' } }],
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((member) => ({
      userId: member.userId,
      username: member.user.username,
      isOwner: member.groups.some(({ group }) => group.isOwner),
      groups: member.groups.map(({ group }) => ({
        id: group.id,
        name: group.name,
      })),
    }));
  }

  async removeMember(
    userId: string,
    organizationId: string,
    memberId: string,
  ): Promise<void> {
    // Quitter l'organisation ne demande aucune permission, retirer quelqu'un si.
    const leaving = memberId === userId;
    if (leaving) await this.access.getPermissions(userId, organizationId);
    else {
      await this.access.requirePermission(
        userId,
        organizationId,
        'MEMBER_REMOVE',
      );
    }
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: memberId } },
      select: { groups: { select: { group: { select: { isOwner: true } } } } },
    });
    if (!member) throw new NotFoundException('Membre introuvable');
    if (member.groups.some(({ group }) => group.isOwner)) {
      throw new ForbiddenException(
        leaving
          ? "Le propriétaire ne peut pas quitter l'organisation"
          : "Le propriétaire ne peut pas être retiré de l'organisation",
      );
    }
    await this.prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId, userId: memberId } },
    });
  }

  async create(userId: string, name: string): Promise<MyOrganizationDto> {
    const { id, plan } = await this.prisma.$transaction(async (tx) => {
      await assertCanJoinOrganization(tx, userId);
      return this.createOwned(tx, userId, name);
    });
    return { id, name, plan, groups: [OWNER_GROUP_NAME] };
  }

  // Reçoit la transaction du signup : un compte n'existe jamais sans son organisation.
  createPersonal(
    tx: Prisma.TransactionClient,
    user: { id: string; username: string },
  ) {
    return this.createOwned(tx, user.id, `Organisation de ${user.username}`);
  }

  // Le créateur est le propriétaire : seul membre du groupe Owner.
  private async createOwned(
    tx: Prisma.TransactionClient,
    ownerId: string,
    name: string,
  ) {
    const organization = await tx.organization.create({
      data: {
        name,
        members: { create: { userId: ownerId } },
        groups: {
          create: [
            { name: OWNER_GROUP_NAME, isOwner: true },
            { name: MEMBER_GROUP_NAME },
          ],
        },
      },
      include: { groups: true },
    });
    const ownerGroup = organization.groups.find((group) => group.isOwner)!;

    await tx.groupMember.create({
      data: {
        groupId: ownerGroup.id,
        organizationId: organization.id,
        userId: ownerId,
      },
    });
    return organization;
  }
}
