import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Permission, Prisma, PrismaClient } from '../generated/prisma/client';
import { GroupDto } from './models/dtos/group.dto';
import {
  ALL_PERMISSIONS,
  OrganizationAccessService,
} from './organization-access.service';

const isPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

@Injectable()
export class GroupService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly access: OrganizationAccessService,
  ) {}

  async list(userId: string, organizationId: string): Promise<GroupDto[]> {
    await this.access.getPermissions(userId, organizationId);
    const groups = await this.prisma.group.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        isOwner: true,
        permissions: true,
        members: { select: { userId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return groups.map(({ members, ...group }) => ({
      ...group,
      permissions: group.isOwner ? ALL_PERMISSIONS : group.permissions,
      memberIds: members.map((member) => member.userId),
    }));
  }

  async create(
    userId: string,
    organizationId: string,
    name: string,
  ): Promise<GroupDto> {
    await this.access.requirePermission(userId, organizationId, 'GROUP_CREATE');
    const group = await this.prisma.group
      .create({
        data: { organizationId, name },
        select: { id: true, name: true, isOwner: true, permissions: true },
      })
      .catch(rethrowDuplicateName);
    return { ...group, memberIds: [] };
  }

  async rename(
    userId: string,
    organizationId: string,
    groupId: string,
    name: string,
  ): Promise<void> {
    await this.access.requirePermission(userId, organizationId, 'GROUP_UPDATE');
    await this.findEditableGroup(organizationId, groupId);
    await this.prisma.group
      .update({ where: { id: groupId }, data: { name } })
      .catch(rethrowDuplicateName);
  }

  async delete(
    userId: string,
    organizationId: string,
    groupId: string,
  ): Promise<void> {
    await this.access.requirePermission(userId, organizationId, 'GROUP_DELETE');
    await this.findEditableGroup(organizationId, groupId);
    await this.prisma.group.delete({ where: { id: groupId } });
  }

  async setPermissions(
    userId: string,
    organizationId: string,
    groupId: string,
    permissions: Permission[],
  ): Promise<void> {
    const own = await this.access.getPermissions(userId, organizationId);
    if (!own.includes('GROUP_MANAGE_PERMISSIONS')) {
      throw new ForbiddenException('Permission insuffisante');
    }
    const group = await this.findEditableGroup(organizationId, groupId);

    // Comme sur Discord : on n'accorde que ce qu'on possède, sinon
    // GROUP_MANAGE_PERMISSIONS suffirait à s'attribuer tous les droits.
    const granted = permissions.filter((p) => !group.permissions.includes(p));
    if (granted.some((permission) => !own.includes(permission))) {
      throw new ForbiddenException(
        'Vous ne pouvez accorder que des permissions que vous possédez',
      );
    }
    await this.prisma.group.update({
      where: { id: groupId },
      data: { permissions },
    });
  }

  async addMember(
    userId: string,
    organizationId: string,
    groupId: string,
    memberId: string,
  ): Promise<void> {
    await this.access.requirePermission(
      userId,
      organizationId,
      'MEMBER_MANAGE_GROUPS',
    );
    await this.findEditableGroup(organizationId, groupId);

    try {
      await this.prisma.groupMember.create({
        data: { groupId, organizationId, userId: memberId },
      });
    } catch (error) {
      // La clé étrangère vers OrganizationMember refuse un non-membre.
      if (isPrismaError(error, 'P2003')) {
        throw new NotFoundException('Membre introuvable');
      }
      if (!isPrismaError(error, 'P2002')) throw error;
    }
  }

  async removeMember(
    userId: string,
    organizationId: string,
    groupId: string,
    memberId: string,
  ): Promise<void> {
    await this.access.requirePermission(
      userId,
      organizationId,
      'MEMBER_MANAGE_GROUPS',
    );
    await this.findEditableGroup(organizationId, groupId);
    await this.prisma.groupMember.deleteMany({
      where: { groupId, userId: memberId },
    });
  }

  // Chercher dans l'organisation de l'URL empêche d'agir sur le groupe d'une
  // autre organisation. Le groupe Owner ne contient que le propriétaire et a
  // toutes les permissions : aucune route ne le modifie.
  private async findEditableGroup(organizationId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, organizationId },
      select: { isOwner: true, permissions: true },
    });
    if (!group) throw new NotFoundException('Groupe introuvable');
    if (group.isOwner) {
      throw new ForbiddenException('Le groupe Owner ne peut pas être modifié');
    }
    return group;
  }
}

function rethrowDuplicateName(error: unknown): never {
  if (isPrismaError(error, 'P2002')) {
    throw new ConflictException('Un groupe porte déjà ce nom');
  }
  throw error;
}
